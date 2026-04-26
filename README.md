# Azure JSON to Mermaid

Azure JSON to Mermaid is a browser-based topology designer for Azure environments. It takes Azure resource exports, models them as a connected graph, and turns them into Mermaid diagrams that can be reviewed, refined, and shared.

The application is built as a static site and is well suited to GitHub Pages. There is no backend dependency, and all parsing and graph generation happen in the browser.

## Why use it

Azure exports are rich, but they are not easy to scan as architecture. This tool helps turn raw resource JSON into something people can reason about:

- high-level estate views for quick orientation
- drill-down topology views for platform and network review
- Mermaid output for documentation, design reviews, and knowledge sharing
- graph exports for downstream tooling and automation

## Core capabilities

- Import one or many Azure JSON files
- Paste raw Azure JSON directly into the workspace
- Normalize mixed payloads into a single topology model
- Generate multiple view levels, including high level, platform, network, and full detail
- Surface provider and resource-type coverage from the imported dataset
- Export Mermaid source, SVG diagrams, and normalized graph JSON

## How it works

The application follows a browser-side pipeline:

1. Load Azure JSON exports
2. Normalize the resource payloads into a common model
3. Discover hierarchy and service relationships
4. Project the graph into a chosen topology view
5. Render the result as a Mermaid diagram

## Product principles

- Static site, easy to host and publish
- Local-first processing in the browser
- Designed for architecture review and documentation workflows
- Resolver-based Azure modeling so service coverage can expand over time

## Azure service modeling

The tool combines two approaches:

- generic ARM ID discovery for broad compatibility across Azure resource types
- service-aware resolvers for richer topology relationships across networking, compute, app, AI, monitoring, analytics, integration, security, and data services

This allows the application to stay useful even with partial exports, while producing deeper and more meaningful topology views when known Azure service patterns are present.

## Project structure

- `index.html` - application shell
- `static/styles.css` - layout, visual language, and interaction styling
- `src/app.js` - UI orchestration and interaction flow
- `src/core/` - normalization, graph modeling, ARM helpers, and service catalog logic
- `src/core/resolvers/` - Azure service-specific relationship resolvers
- `src/render/mermaid.js` - Mermaid output generation

## Deployment

This repository is intended to be published as a static web application, including through GitHub Pages.

Deployment is simple:

1. Publish the repository as a static site
2. Open the application in a browser
3. Load Azure JSON exports into the workspace

## Local sample data

Sample Azure exports can be kept in a local `json/` folder for testing and development. That folder is intentionally ignored from source control.
