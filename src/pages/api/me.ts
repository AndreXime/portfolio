import type { APIRoute } from "astro";
import { getSite } from "../../lib/content";

export const prerender = true;

export const GET: APIRoute = async () => {
	const site = await getSite("pt");

	const me = {
		name: site.authorName,
		role: site.person.jobTitle,
		level: "junior",
		stack: ["TypeScript", "NestJS", "Node.js"],
		location: site.hero.locationValue,
		openToWork: true,
		_note: "Você achou o easter egg. Curioso o bastante pra dar curl nisso? Entra em contato.",
	};

	return new Response(`${JSON.stringify(me, null, 2)}\n`, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "public, max-age=86400",
			"X-Robots-Tag": "noindex",
		},
	});
};
