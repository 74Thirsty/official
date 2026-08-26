# Lost Limb Riders — Documentation System Test Fixtures
## Fixture source tree (miniature Autobiography-style repo used by tests)

A small, self-contained Markdown tree that mimics the real repository's metadata and
reference conventions. The engine tests index this fixture (not the live submodule) so the
suite is fast, deterministic, and needs no network.

Layout:

```
docs-fixture/
  03-HUMAN-RESOURCES/
    HR-POL-001-Employment-Policy.md
    HR-SOP-002-Recruitment-SOP.md
    HR-FORM-004-Offer-Letter-Template.md
    HR-CHK-002-Employee-Onboarding-Checklist.md
  05-FINANCE/
    FIN-PROC-004-Payroll-Procedure.md
  12-COMPLIANCE/
    CMP-IA-001-Iowa-Matrix.md
  ARCHIVE/
    OLD-001-Legacy-Notice.md
```

Relationship cases exercised:
- Controlled-ID cross-references that resolve to real files.
- A broken .md path reference that does not resolve (integrity BROKEN_REFERENCE).
- A self-reference by ID that must be excluded.
- An archived document under `ARCHIVE/` classed `Archived` / not-authoritative.
- A document missing metadata (owner) → integrity MISSING_METADATA.