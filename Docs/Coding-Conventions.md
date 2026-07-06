# Coding conventions

- Descriptive error messages and error catching
- Functions should have doc style comments
- random comments needed to explain something should be 3 lines or less.
- dont be afraid to use longer variable names if it makes a big difference in readablity.
- use camelCase for variables and functions, use PascalCase for classes, use PascalCase for React component files in the frontend (e.g. `Header.tsx`). Exception: shadcn/ui primitives keep the lowercase filenames the shadcn CLI generates (e.g. `button.tsx`).
- Structure React state in flat way.
- Use components in react.
- use snake case for backend files
- Imports: always use the subpath aliases (#controllers/_, #models/_)
- TypeScript strictness: no any (or when it's tolerated), avoid non-null assertions (!), prefer explicit return types on exported functions.
- function react components only, use separate interfaces for props.
- use tailwind variables when repeating colours.
