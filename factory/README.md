# Business Output Factory

A small, repeatable way to turn **verified information + a business objective** into an asset that
earns, saves or de-risks something, and to keep the reusable parts so the next project starts
further ahead.

Nothing here needs an AI session to keep working. The tools are plain Python, spreadsheets and CI.

## How a project runs

| Step | Output | Where |
|---|---|---|
| 1. Brief: who it is for, the problem, the outcome, why it matters | A brief with testable acceptance criteria | [`templates/PROJECT_BRIEF.md`](templates/PROJECT_BRIEF.md) |
| 2. Inspect what exists: repos, documents, data, components | List of reusable pieces | the brief, §2 |
| 3. Evidence: every number gets a **source** and a **status** | Assumption register | the project config |
| 4. Build the smallest useful deliverable | Code, model, document or page | project repo |
| 5. Verify: reproduce source figures, test, cross-check | Passing tests and a check report | project repo |
| 6. Deliver: what was produced, verified and left open; cost, risks, lessons, next action | Delivery report | [`templates/DELIVERY_REPORT.md`](templates/DELIVERY_REPORT.md) |
| 7. Reuse: anything needed twice becomes a component here | New or improved component | this folder |

**Evidence status vocabulary.** It is used in configs, workbooks and reports:
- `report`: from a planning document
- `assumption`: analyst judgement
- `research`: a public source, cited
- `quote`: a supplier or partner quotation
- `actual`: invoices or real operating data

Until a number is a `quote` or an `actual`, the tools keep it visibly flagged.

## Standards

- **No invention.** Never invent findings, customers, results, testimonials or financial outcomes. Example data is labelled *FICTIONAL*.
- **Deterministic first.** Repeatable calculations and business rules live in tested code. AI is used for research, synthesis and writing, never as the calculator.
- **Verify before claiming.** A deployment, integration or number is "done" only after a test or check shows it.
- **Confidential data stays private.** This repository is **public** and also serves the parmarpro.in website. Costs, margins, customer data and credentials never go here. Project data lives in private repositories; this folder holds only reusable tools and fictional examples.
- **Approval for consequential actions.** Publishing, spending, or contacting customers and partners needs the founder's go-ahead.

## Components

### `unit_economics`: pricing and unit economics for physical products

For a product sold through distributors, retailers and online channels, it answers:

- What does each partner keep, and what does the brand keep, per route? This includes free-goods schemes such as 10 + 1.
- What does each online offer earn per order? It reports break-even acquisition cost, break-even shipping cost, and orders needed to recover the acquisition cost.
- Is the price ladder consistent? A bigger pack must cost less than any mix of smaller packs, including shipping fees and free-shipping thresholds.
- What does a period P&L look like, from a blended price or a channel mix, and what all-in cost per unit does it imply?
- How do the answers move under named sensitivities, for example GST, CAC or cost changes?
- Which inputs are still assumptions?

```bash
cd factory
python -m unit_economics check    examples/example_product.toml   # findings; exit 1 on structural price errors
python -m unit_economics report   examples/example_product.toml --out report.md --json results.json
python -m unit_economics workbook examples/example_product.toml --out model.xlsx
python -m unit_economics verify   examples/example_product.toml   # workbook vs engine, cell by cell
```

- **Config:** a TOML file. [`examples/example_product.toml`](examples/example_product.toml) is a commented template with fictional numbers. Copy it into a private repo for real products.
- **Workbook:** live formulas, with inputs in blue and a yellow fill while an input is still an assumption. Sheets: README, Inputs, Offline, Online, Ladder, Scenarios, Checks. `workbook` recalculates the file in LibreOffice and writes it only if every tracked result cell matches the engine, so the spreadsheet a founder edits is proven to compute what the tested code computes.
- **Number formats:** Markdown reports always use Indian grouping (₹10,00,000). Workbooks use plain `#,##0`, which Excel shows in lakhs on an Indian locale. Conditional formats are avoided because some apps drop the minus sign inside them.
- **Checks:**

  | Severity | Codes |
  |---|---|
  | error | `LADDER_DOMINATED`, `ONLINE_LOSS_BEFORE_MARKETING`, `NEGATIVE_DISTRIBUTOR_MARGIN`, `SCENARIO_OPERATING_LOSS` |
  | warning | `ONLINE_BELOW_TARGET`, `OFFLINE_BELOW_TARGET`, `GROSS_MARGIN_BELOW_TARGET`, `PLANNING_COST_OUT_OF_RANGE`, `LADDER_PER_UNIT` |
  | info | `RETAILER_MARGIN_OUTSIDE_BAND`, `SCENARIO_COST_ABOVE_PLANNING` |

- **Use from another repository:** pin a commit, then

  ```bash
  pip install "unit-economics[workbook] @ git+https://github.com/parmarvpro/Parmarpro@<commit>#subdirectory=factory"
  ```

  This installs the `unit-economics` command and the `unit_economics` package.

## Tests

```bash
cd factory && python -m unittest discover -s tests -v
```

The tests check hand-worked numbers, config validation, ladder logic, reports and the CLI. Where
LibreOffice is installed they also recalculate the workbook and prove that a deliberately wrong formula
is caught. CI runs them on every change under `factory/` ([workflow](../.github/workflows/factory-tests.yml)).

## Cost, dependencies and limits

| Item | Needed for | Cost |
|---|---|---|
| Python 3.11+ (standard library only) | engine, reports, checks | free |
| `openpyxl` (MIT) | writing workbooks | free |
| LibreOffice (MPL) | recalculating and verifying workbooks; tests skip without it | free |
| GitHub Actions | CI | free on standard runners for public repos. Private repos on GitHub Free get 2,000 min/month ([GitHub docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). A full run takes a few minutes, mostly installing LibreOffice. |

No paid APIs, hosting or runtime AI calls. Ongoing cost: ₹0.

**Known limits**
- The workbook's ladder sheet tests same-size multiples (e.g. 2 × 6-pack); the engine also tests mixed combinations (6 + 3 + 3). They agree whenever each pack size divides the larger ones.
- Online costs are per order. Weight- or zone-based courier slabs must be entered per offer or approximated.
- A scheme applies to the brand's direct customer. Distributor pass-through of schemes to retailers is not modelled.

The `factory/` folder is excluded from the parmarpro.in website build by the root `_config.yml`.
