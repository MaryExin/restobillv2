# AGENTS.md

## Project overview

This is a full-stack app with:

- `frontend/` → React Vite frontend
- `backend/` → PHP API
- `database/` → database schema and sample files (csv) structure

## Source of truth

When analyzing database structure, always read:

1. `database/.csv files` → source of truth for tables, columns, types, nullability, keys, and indexes
2. `database/README.md` → explanation of relationships and table purpose
3. `database/seed.sql` or CSV files → sample values only, not schema source of truth

## Working rules

- Read `database/.csv` before editing backend endpoints that touch the database.
- When changing frontend forms, verify backend field names and DB column names first.
- Do not assume payload keys or column names. Verify them from the schema.
- Prefer small, safe fixes over unnecessary refactors.
- Preserve existing folder structure unless explicitly asked to reorganize it.
  -the csv file name is the table name and all columns there are the fields and the data.

## Frontend rules

- Frontend are files and folders aside from backend and database folder`
- Stack: React + Vite
- If backend payload names change, update the related frontend fetch calls and validation.
- Route comes from myapp/src/App.jsx
- A new Route will come from a Page under src/pages and a Page is has a child Component under src/components/Relevant Folder
- For color scheme use this  
   darkerPrimary: "var(--color-darkerPrimary)",
  darkPrimary: "var(--color-darkPrimary)",
  medPrimary: "var(--color-medPrimary)",
  softPrimary: "var(--color-softPrimary)",
  softerPrimary: "var(--color-softerPrimary)",
  colorBrand: "var(--color-brandPrimary)",
  colorBrandSecondary: "var(--color-brandSecondary)",
  colorBrandTertiary: "var(--color-brandTertiary)",
  colorBrandLighter: "var(--color-lighter)",
  colorBrandLight: "var(--color-light)",
  redAccent: "var(--color-redaccent)",
  -Use our font in classname as font-[Poppins-Light], font-[Poppins-Medium], font-[Poppins-Regular], font-[Poppins-SemiBold], font-[Poppins-Bold], font-[Poppins-ExtraBold], font-[Poppins-Black]
  -we are using Zustand as context (folder) or Local Storage for Global variables though if need to persists use local storage instead
  -we have hooks folder for our hooks
  -We use .env for our api VITE_ENDPOINTS calls
  - We use this for mutations

    const {
    data: approvalcredsData,
    isLoading: approvalcredsIsLoading,
    mutate: approvalcredsMutate,
    } = useCustomSecuredMutation(
    localStorage.getItem("apiendpoint") +
    import.meta.env.VITE_MUTATE_APPROVAL_CREDS_ENDPOINT,
    );

  - FOr read query we usullay use this
    const { data: chartOfAccountsMap, isLoading: chartOfAccountsMapIsLoading } =
    useCustomQuery(
    localStorage.getItem("apiendpoint") +
    import.meta.env.VITE_PARAMS_DISTINCT_CHART_MAP_DATA_READ_ENDPOINT,
    "chartofaccountsmap",
    );

- For roles usually use this

const { roles } = useZustandLoginCred();

const roleSet = useMemo(() => {
const arr = Array.isArray(roles?.[0]) ? roles[0] : [];
return new Set(
arr.map((r) =>
String(r?.rolename || "")
.trim()
.toUpperCase(),
),
);
}, [roles]);

## Backend rules

- Backend is in `backend/`
- Stack: PHP
- Keep request/response format backward-compatible unless explicitly asked to change it.
- Verify SQL columns against `database/schema.sql` before modifying queries.
  -We have api/ for the our enpoints usually called thru the frontends env (dynamic)
  -WE have src for the Controller and Gateway which the api/endpoint is connected.

## Database rules

- Database docs are in `database/`
- `schema.sql` is the source of truth
- CSV files are for sample content only
- Nullable fields must be treated properly in validation and inserts
- Avoid Duplicating same parameter names on BindValue on parametered statements
- give me also sql table create command utf8mb4_general_ci if there are new tables to create

## Integration workflow

When asked to integrate frontend and backend:

1. Identify the frontend component involved
2. Identify the backend endpoint involved
3. Identify the DB table and columns involved
4. Check for mismatched names, wrong types, and nullable issues
5. Apply the smallest safe fix
6. Summarize what changed

## Output expectations

When making changes:

- say which files were inspected
- say which files were changed
- mention field mismatches found
- mention assumptions clearly

## Validation checklist

Before finishing:

- check frontend payload keys
- check backend request parsing
- check SQL column names
- check null handling
- check date/time formatting
- check response shape consistency
