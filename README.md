# Algebra with Khalid

**Every equation. Every step, explained.**

A complete, locally runnable algebra learning website. Enter a one-variable linear equation and follow exact symbolic transformations, with explanations and answer verification.

## Run locally

You need **Node.js 22.13 or newer** and npm. Node.js 22 LTS is recommended for this project.

Open Terminal in this folder, then run:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** in your browser. If the port is occupied, use the local URL printed in Terminal. Keep Terminal running; press **Control+C** to stop.

On this computer, the project folder is:

```sh
cd /Users/khalid/Documents/Codex/2026-09-05/i-x20/outputs/solvex
npm run dev
```

Dependencies are already installed here. For a copy on another computer, run `npm ci` first. You can also double-click **Start SolveX.command** on macOS; it installs dependencies if needed and starts the website.

The hosted version uses Abaarso School email sign-in. Enter an `@abaarsoschool.org` or `@studentabaarso.org` address at `/login.html`; the account and activity data are protected in Supabase. Local math still works without a backend, but sign-in requires the public Supabase settings in `.env.local` (see `.env.example`).

## How to use it

1. Enter an equation and click **Solve equation**, or press **Enter**. If you edit the input, the previous solution is labeled until you submit the new equation.
2. Use **Next step** to reveal one transformation at a time, or **Show all steps** for the whole walkthrough.
3. Choose **Quick**, **Guided**, or **Teach me**. Violet highlights identify terms that changed between steps.
4. Open **Why?** for the reasoning. **Teach me** also shows the operation applied to both sides.
5. Open **Let’s check the answer** to see the answer substituted into the original equation.
6. Use **Practice** to submit your own next equation. Equivalent valid steps are accepted, including alternative methods.
7. Reopen a recent equation from the sidebar. History is stored only in this browser; the clear button removes it.

## Adaptive Challenge tab

Open **Challenge** in the top navigation, or visit **http://localhost:3000/challenge**.

- A fresh equation is generated randomly when you arrive.
- Enter the value of x as a number, exact fraction, or `x = ...`, then choose **Check answer**.
- Every correct answer unlocks exactly one higher level. Choose **Next challenge** for the next random equation.
- Incorrect answers allow retries without changing the level. **Different problem, same level** generates a replacement without advancing.
- Levels introduce addition, subtraction, multiplication, two-step equations, negatives, parentheses, variables on both sides, and fractions. Advanced levels add nesting and increase the coefficient range each level.
- Hints suggest the first operation. Progress is saved separately from solver history, only on this device.

The challenge generator verifies every equation with the exact symbolic solver and avoids repeating the immediately previous equation. Correct submissions can only earn a problem's level once. Signed-in students keep progress in their school account across devices.

## School accounts

Students sign in with a six-digit email verification code. Both `@abaarsoschool.org` and `@studentabaarso.org` addresses are accepted. The teacher dashboard is available at `/dashboard.html` to `kismail@abaarsoschool.org`; it shows verified sign-ins, question topics, submitted equations, and challenge results. Students can see only their own account data.

## Supported equations

- One letter as the variable, such as `x`, `y`, or `a`.
- Addition, subtraction, multiplication (`*`, `×`, or implicit multiplication), and division by constant expressions.
- Parentheses, negative numbers, decimals, and exact fractions.
- Variables on both sides, identities (all real numbers), and contradictions (no solution).

Examples:

```text
3(2x - 5) + 4 = 19        → x = 5
2x + 5 = 17              → x = 6
4(x - 3) = 20            → x = 8
(x + 2)/5 = 3            → x = 13
(x + 2)/5 = (3x - 1)/4   → x = 13/11
0.1x + 0.2 = 0.3         → x = 1
```

This is the focused linear-equation version described at the end of the brief. Quadratics, radicals, variable denominators, systems of equations, graphing, and written instructions are intentionally rejected with helpful messages. Use ordinary keyboard notation rather than LaTeX commands. Inputs are bounded to keep parsing responsive.

## Static production build

```sh
npm run build
npm start
```

Open the local URL printed by Vinext. The build emits static HTML, CSS, and JavaScript in `dist/client`, which is the same artifact used by GitHub Pages. `npm run dev` is the simplest everyday local workflow.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. Pushes to `main` run the checks above, build the static export, and publish it to GitHub Pages. The project site URL is:

```text
https://ismakh9.github.io/algebra-with-khalid/
```

The workflow supplies the repository path automatically so the Challenge tab and all assets work from the project URL. GitHub Pages deployment is free for this public repository.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The test suite covers the original four-step example, changing equations, exact fractional arithmetic, invalid input, practice feedback, identities, contradictions, 378 generated solver equations, and 700 random challenge equations across beginner and advanced levels. Each generated equation’s intermediate steps are independently solved to check that they preserve its solution.

Lint targets the application and tests. The generated shadcn component catalog remains untouched. An optional `solve_linear_equation` WebMCP tool is feature-detected in compatible browsers; browsers without it use the regular interface. Its browser integration has not been tested in a supporting WebMCP context.

## Project map

- `app/solver.tsx`: solver interface, explanation modes, examples, practice, and local history.
- `app/page.tsx`: static home route wrapper for the solver.
- `app/globals.css`: responsive layout, visual design, accessible focus states, and reduced-motion support.
- `lib/solver.ts`: bounded equation parser and exact rational arithmetic using BigInt; no `eval` or language model.
- `components/math.tsx`: mathematical typography, fractions, and changed-term highlights.
- `tests/solver.test.ts`: arithmetic and regression coverage.
- `app/challenge/`: the adaptive Challenge tab.
- `lib/challenges.ts`: random generation, exact answer checks, and level progression.
- `tests/challenges.test.ts`: difficulty, variety, answer validation, and progression coverage.

Built with React, TypeScript, Vinext/Vite, the provided shadcn primitives, and Lucide icons. The full source and lockfile are included. The same source supports both local use and the hosted website.
