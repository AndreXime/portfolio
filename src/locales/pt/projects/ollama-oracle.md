---
order: 3
experimental: true
title: "Chat corporativo com RAG local: respostas com fonte e sem inventar política"
shortDescription: "Lab de chatbot corporativo com RAG local para consultar políticas, cursos e onboarding sem enviar a base a APIs externas. Stack em Bun, Hono, React, Ollama e ChromaDB, com embeddings e geração no ambiente local. O retrieval filtra por distância, reordena por overlap lexical e recorre ao fallback lexical quando a similaridade vetorial é fraca. A resposta sai em streaming NDJSON, com cancelamento e fontes por trecho."
tech: ["Bun", "Hono", "React", "Ollama", "ChromaDB", "LangChain"]
imageUrl: "../../../assets/projects/ollama-oracle.png"
github: "https://github.com/AndreXime/ollama-oracle"
---

## Contexto técnico

Modelei um monorepo Bun com workspaces: API Hono em TypeScript e UI React (Vite) servida pelo mesmo processo em produção. Ollama e ChromaDB rodam em Docker Compose para manter embeddings e geração no ambiente local, alinhado à regra de não expor a base corporativa a provedores externos. A subida é ordenada: o Ollama baixa os modelos no primeiro start, uma ingestão one-shot recria a coleção e só então a app sobe. Na app, a conexão com as dependências é tentada em loop até elas responderem. O liveness é trivial e o readiness confirma os modelos no Ollama e a coleção no Chroma.

O modelo de chat é pequeno (qwen2.5:3b, com contexto de 4096 tokens), e isso guiou as decisões: poucos trechos no prompt e recusa explícita quando a base não cobre a pergunta.

## Desafios de engenharia (como e por quê)

- **Retrieval com portões de distância:** recupero muito mais candidatos do que cabem no prompt, descarto os que passam da distância máxima aceita e exijo que o melhor deles seja bom o bastante. O que sobra é deduplicado por conteúdo, reordenado por overlap de termos com a pergunta e cortado em poucos trechos para caber no contexto do modelo.
- **Fallback lexical quando o vetor falha:** se o melhor embedding fica fraco demais, procuro nos mesmos candidatos trechos que compartilham ao menos dois termos da pergunta e podo os de overlap bem menor que o melhor. Perguntas com vocabulário institucional, como o nome da empresa, ainda recuperam trechos úteis sem afrouxar o filtro vetorial para todas as consultas.
- **Modos de turno e anti-alucinação:** cada turno cai em RAG, fallback lexical, conversa ou limitação. Saudação e agradecimento vão por um prompt conversacional, sem fontes. Pergunta de negócio sem trecho bom recebe uma mensagem fixa pedindo reformulação, em vez de deixar o modelo inventar política.
- **Stream com cancelamento:** a API responde em NDJSON com ping, deltas e um evento final com as fontes. Quando o cliente desconecta, aborto a geração no Ollama sem emitir erro. A UI cancela a requisição anterior ao enviar outra pergunta e ao desmontar, e ignora envios enquanto há resposta em andamento.
- **Ingestão tipada por formato:** Markdown e texto viram uma parte, CSV vira uma parte por registro e JSON extrai subdocumentos conforme a forma (string, lista de strings, `content` ou `documents`). Cada parte é quebrada em chunks de 900 caracteres com overlap de 120, e a leitura tem teto de tamanho por arquivo para não estourar memória. Os metadados viram referências como `arquivo.md#p0-c12` nas fontes do chat.
- **Observabilidade e proteção do endpoint:** gravo um JSONL por dia, com um registro por turno: pergunta, resposta, modo, distâncias, fontes e se houve abort. Assim ajusto os limiares com dados, sem adivinhar qualidade pela UI. O endpoint tem rate limit por IP, validação do body com Zod e teto de payload.

## Limite conhecido

A API aceita até 20 turnos de histórico, mas o padrão é histórico desligado, e a busca usa só a pergunta atual para não poluir o embedding de um modelo pequeno. Follow-ups curtos como "e para PJ?" não herdam contexto, e o chat orienta a reenviar a pergunta completa.
