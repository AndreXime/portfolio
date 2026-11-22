interface ProfilePayload {
	name: string;
	role: string;
	level: string;
	stack: string[];
	location: string;
	openToWork: boolean;
}

const JQ_FILTER = "'{role, level, openToWork, stack}'";

function escapeHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function formatJqOutputHtml(profile: ProfilePayload): string {
	const asString = (value: string) => `<span class="term-string">"${escapeHtml(value)}"</span>`;
	const stack = profile.stack.map((item) => asString(item)).join(", ");

	return [
		`{`,
		`  <span class="term-key">"role"</span>: ${asString(profile.role)},`,
		`  <span class="term-key">"level"</span>: ${asString(profile.level)},`,
		`  <span class="term-key">"openToWork"</span>: <span class="term-ok">${profile.openToWork}</span>,`,
		`  <span class="term-key">"stack"</span>: [${stack}]`,
		`}`,
	].join("\n");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function tokenizeCommand(line: string): string[] {
	const parts: string[] = [];
	const regex = /(\s+)|('(?:\\'|[^'])*')|("(?:\\"|[^"])*")|(\S+)/g;
	let match = regex.exec(line);
	while (match) {
		parts.push(match[0]);
		match = regex.exec(line);
	}
	return parts;
}

function highlightToken(token: string): string {
	if (/^\s+$/.test(token)) return escapeHtml(token);
	if (token === "|" || token === ">") {
		return `<span class="term-op">${escapeHtml(token)}</span>`;
	}
	if (token.startsWith("-")) {
		return `<span class="term-flag">${escapeHtml(token)}</span>`;
	}
	if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
		return `<span class="term-str">${escapeHtml(token)}</span>`;
	}
	if (token.includes("/") || token.includes(".")) {
		const cls = token.endsWith(".txt") ? "term-file" : "term-url";
		return `<span class="${cls}">${escapeHtml(token)}</span>`;
	}
	if (["curl", "tee", "grep", "jq", "cat"].includes(token)) {
		return `<span class="term-cmd">${escapeHtml(token)}</span>`;
	}
	return escapeHtml(token);
}

function highlightCommandLine(line: string): string {
	return `<span class="term-prompt">$</span> ${tokenizeCommand(line).map(highlightToken).join("")}`;
}

function placeCursor(screen: HTMLElement): void {
	for (const node of screen.querySelectorAll(".term-cursor")) node.remove();
	screen.insertAdjacentHTML("beforeend", '<span class="term-cursor" aria-hidden="true"></span>');
}

async function typeCommandLine(screen: HTMLElement, line: string, signal: AbortSignal): Promise<void> {
	screen.insertAdjacentHTML("beforeend", '<span class="term-prompt">$</span> ');
	placeCursor(screen);

	for (const token of tokenizeCommand(line)) {
		if (signal.aborted) return;
		const cursor = screen.querySelector(".term-cursor");
		const html = highlightToken(token);
		if (cursor) cursor.insertAdjacentHTML("beforebegin", html);
		else screen.insertAdjacentHTML("beforeend", html);
		await sleep(Math.min(120, 28 + token.trim().length * 12));
	}
}

function curlLine(apiHost: string): string {
	return `curl -s -o profile.txt ${apiHost}/api/me`;
}

function jqLine(): string {
	return `jq ${JQ_FILTER} profile.txt`;
}

function renderStatic(screen: HTMLElement, apiHost: string, profile: ProfilePayload): void {
	screen.innerHTML = [
		highlightCommandLine(curlLine(apiHost)),
		highlightCommandLine(jqLine()),
		formatJqOutputHtml(profile),
	].join("\n");
}

async function playTerminal(
	screen: HTMLElement,
	apiHost: string,
	profile: ProfilePayload,
	signal: AbortSignal,
): Promise<void> {
	screen.innerHTML = "";
	await typeCommandLine(screen, curlLine(apiHost), signal);
	if (signal.aborted) return;

	for (const node of screen.querySelectorAll(".term-cursor")) node.remove();
	screen.insertAdjacentHTML("beforeend", "\n");
	await sleep(420);
	if (signal.aborted) return;

	await typeCommandLine(screen, jqLine(), signal);
	if (signal.aborted) return;

	for (const node of screen.querySelectorAll(".term-cursor")) node.remove();
	screen.insertAdjacentHTML("beforeend", "\n");
	await sleep(140);
	if (signal.aborted) return;

	for (const line of formatJqOutputHtml(profile).split("\n")) {
		if (signal.aborted) return;
		screen.insertAdjacentHTML("beforeend", `${line}\n`);
		await sleep(64);
	}

	screen.insertAdjacentHTML("beforeend", '<span class="term-prompt">$</span> ');
	placeCursor(screen);
}

export function initHeroTerminal(): void {
	const root = document.querySelector<HTMLElement>("[data-hero-terminal]");
	const screen = document.querySelector<HTMLElement>("[data-hero-terminal-screen]");
	if (!root || !screen) return;

	if (window.matchMedia("(max-width: 1023px)").matches) return;

	const apiHost = root.dataset.apiHost ?? "https://andreximenes.xyz";
	let profile: ProfilePayload;
	try {
		profile = JSON.parse(root.dataset.profile ?? "{}") as ProfilePayload;
	} catch {
		return;
	}

	const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

	if (prefersReducedMotion) {
		renderStatic(screen, apiHost, profile);
		return;
	}

	void playTerminal(screen, apiHost, profile, new AbortController().signal);
}
