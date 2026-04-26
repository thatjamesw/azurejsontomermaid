# Azure JSON to Mermaid

Azure JSON to Mermaid is a static browser application that turns Azure resource exports into Mermaid topology diagrams.

The app is designed for GitHub Pages deployment and runs entirely in the browser. You can load one or many Azure JSON payloads, normalize them into a graph, and generate drill-down topology views without a backend service.

## What it does

- Imports Azure JSON files and pasted JSON payloads
- Normalizes mixed Azure resource exports into a single topology graph
- Generates Mermaid diagrams for multiple levels of detail
- Supports drill-down views such as high level, platform, network, and full detail
- Surfaces provider and resource-type coverage for imported data
- Exports Mermaid source, SVG output, and normalized graph JSON

## How it works

The application uses a browser-side pipeline:

1. Load Azure JSON exports
2. Normalize resources into a common model
3. Build resource relationships and hierarchy
4. Project the graph into a chosen topology view
5. Render the result as a Mermaid diagram

## Key design choices

- Static front end suitable for GitHub Pages
- No server-side processing
- No Flask or Python runtime required
- Local-first workflow for reviewing Azure topology safely in the browser
- Resolver-based architecture so Azure service support can grow over time

## Project structure

- `index.html` - application shell
- `static/styles.css` - visual design and layout
- `src/app.js` - UI orchestration and interaction logic
- `src/core/` - normalization, graph modeling, ARM helpers, and Azure service catalog
- `src/core/resolvers/` - Azure service-aware relationship resolvers
- `src/render/mermaid.js` - Mermaid output generation

## Azure coverage

The app includes both:

- generic ARM ID discovery for broad compatibility across Azure services
- service-aware resolvers for richer relationships across networking, compute, app, AI, monitoring, analytics, integration, security, and data services

This means the tool can produce useful topology diagrams even for partial exports or less common resource types, while providing deeper relationship modeling where Azure-specific patterns are known.

## Deployment

This repository is intended to be published as a static site, including GitHub Pages.

Because the app is front-end only, deployment is lightweight:

- host the repository as a static site
- open the site in a browser
- load Azure JSON exports directly into the workspace

## Local sample data

Azure sample exports can be kept in a local `json/` folder for testing, but they are intentionally ignored from source control.
