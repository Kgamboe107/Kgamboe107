# Skills library

Claude skills kept here for later. They are **not active**: Claude Code only loads skills from `.claude/skills/`. Nothing in this folder goes into the desktop installer or the phone website.

## Design skills (`design/`)

| Folder | What it does | Source (license) |
|---|---|---|
| `ui-ux-pro-max` | Searchable design rules: styles, palettes, font pairings, UX and accessibility checks | nextlevelbuilder/ui-ux-pro-max-skill (MIT) |
| `impeccable` | Critique, audit, polish or redesign an existing UI | pbakaus/impeccable (Apache-2.0) |
| `design-taste-frontend` | Taste Skill: anti-generic design for marketing and company websites | Leonxlnx/taste-skill (MIT) |
| `frontend-slides` | Animated HTML slide decks; converts PowerPoint files | zarazhangrui/frontend-slides (MIT) |
| `diagram-design` | Editorial HTML/SVG diagrams: flowcharts, org charts, timelines, swimlanes | cathrynlavery/diagram-design (MIT) |

Copied on 2026-11-10 from each project's GitHub repository, without its tests and CI files.

Some helpers download extra tools when you run them, never on their own:
- Impeccable's checker downloads its engine from the project's GitHub releases and verifies it against a bundled checksum.
- Frontend Slides publishes a deck online only when you ask it to deploy.

## Turn one on

Copy its folder into `.claude/skills/`, for example:

```
cp -r skills-library/design/impeccable .claude/skills/
```

Turn on one design skill at a time. They each try to own "how to build a page" and give conflicting advice when used together.
