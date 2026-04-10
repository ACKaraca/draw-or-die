# AGENTS.md

### 1. Project Overview
**Draw or Die** is AI-powered architectural jury application. Architecture students upload their projects (drawings, render, sketches, or PDFs), state their concepts, and face a brutal (or constructive) AI jury. Depending on the feedback, they can be placed in the "Hall of Fame" or "Wall of Death". 

Key mechanics:
- **Rapido Economy**: Users spend "Rapido" pens for analysis. Costs are defined in `lib/pricing.ts`:
  - Single Jury: 2, Revision (same): 1, Revision (different): 2, Multi Jury: 5, Multi Jury Revision: 2, Premium Rescue: 2, Defense: 5, AI Mentor: 1, Auto Concept: 5, Material Board: 3.
  - Tier defaults: Guest 10, Anonymous 30, Registered 50, Premium 200.
- **Progression Score**: Earning points through project revisions or successfully defending a project in Chat mode.
- **Jury Personas**: Distinct tones ranging from Constructive to "Brutal Roast".

### 2. Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS & Framer Motion
- **Language**: TypeScript
- **AI Model**: Google Gemini (gemini-3.1-pro-preview)
- **File Parsing**: `pdfjs-dist` for PDF rastering and text extraction (OCR).
- **Icons**: `lucide-react`
- **Other**: `canvas-confetti`, `react-dropzone`, `react-markdown`.

### 3. Architecture & Modularity
The core application logic was initially in `app/page.tsx`, functioning as a large single-page state machine. It is now refactored into modular components located in the `components/` directory:
- `Header.tsx`: Top navigation and user stats.
- `HeroStep.tsx`: Landing page.
- `UploadStep.tsx`: File upload dropzone and requirement form.
- `ResultSteps.tsx` : UI for Standard and Premium (Red Pen) results.
- `GalleryStep.tsx`: UI for Hall of Fame / Wall of Death.
- `ChatDefense.tsx`: Reusable module for the Jury Defense Chat interaction.

### 4. AI & Prompt Engineering Guidelines
- **JSON Structure**: Always request `application/json` as the response mime type from Gemini. Provide a strict JSON schema in the API call to guarantee structured outputs.
- **Tone & Persona**: Instructions related to the jury's tone (Harshness 1-5) must be strictly passed to the prompt.
- **Context**: Pass the `pdfText` (if available) to the prompt to give the AI context about the labels/text in the drawing.

### 5. Future Phases (Gamification Update)
- **Weekly Charettes**: Weekly design prompts with rewards.
- **Leaderboards**: Global ranking based on university/studio.
- **Badges**: Achievements for surviving brutal juries.
- **Multi-Persona Jury**: 3 different personas critiquing simultaneously.
- **Social Tools**: "Roast My Project" export, Peer Reviews, Anonymous Confessions.

### 6. Development Rules
- Use modern React patterns (functional components, hooks).
- Ensure TypeScript types are explicitly defined when refactoring.
- Verify imports perfectly (use `@/components/...` style paths).
- Run `npm run lint` and `npx tsc --noEmit` to verify code health before concluding tasks.
