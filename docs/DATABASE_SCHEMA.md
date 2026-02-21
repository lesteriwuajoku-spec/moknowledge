# Knowledge Base Database Schema Design

Design for multiple companies (MoFlo customers), multiple knowledge bases per company, and versioning for history and rollback.

## Tables

### `companies`

| Column       | Type         | Description                |
|-------------|--------------|----------------------------|
| id          | uuid PK      | Company identifier         |
| name        | text         | Display name               |
| created_at  | timestamptz  | Created at                 |
| updated_at  | timestamptz  | Last updated               |

### `knowledge_bases`

| Column       | Type         | Description                |
|-------------|--------------|----------------------------|
| id          | uuid PK      | Knowledge base ID          |
| company_id  | uuid FK → companies | Owner company      |
| source_url  | text NOT NULL| Website URL scraped        |
| version     | int          | Increment on each update   |
| is_current  | boolean      | Only one true per company  |
| scraped_at  | timestamptz  | When scrape ran            |
| created_at  | timestamptz  | Row created                |
| updated_at  | timestamptz  | Row updated                |
| payload     | jsonb        | Full KnowledgeBase JSON    |

- Unique index on `(company_id, version)`.
- Partial unique index: `WHERE is_current = true` on `(company_id)` so only one current KB per company.

### `knowledge_base_sections` (optional, for querying)

For search/filter without parsing the whole JSONB:

| Column       | Type         | Description                |
|-------------|--------------|----------------------------|
| kb_id       | uuid FK → knowledge_bases | |
| section_key | text         | e.g. companyFoundation     |
| content     | text         | Concatenated text for search |
| created_at  | timestamptz  |                            |

- Index on `(kb_id, section_key)` and GIN on `content` for full-text search.

## Relationships

One company has many knowledge_bases (version history). Each knowledge_base belongs to one company. Optionally knowledge_base_sections point to knowledge_bases.

## Row Level Security (RLS)

For companies and knowledge_bases: users only see rows for companies they’re in (e.g. via a memberships table with user_id and company_id). Policy idea: `SELECT WHERE company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid())`. Same idea for knowledge_base_sections via kb_id → company_id.

## Versioning

On save/update: insert a new row with version = max(version)+1, set the previous row’s is_current to false, set the new row’s is_current to true. To get the current KB for a company: `WHERE company_id = ? AND is_current = true`. Old versions stay for history and rollback.

## Supabase Bonus: SQL Sketch

```sql
-- companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- knowledge_bases
create table knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  source_url text not null,
  version int not null default 1,
  is_current boolean not null default true,
  scraped_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  payload jsonb not null,
  unique (company_id, version)
);

create unique index idx_kb_current on knowledge_bases (company_id) where is_current = true;

-- RLS
alter table knowledge_bases enable row level security;
create policy "Users can read KB for their companies"
  on knowledge_bases for select
  using (company_id in (select company_id from memberships where user_id = auth.uid()));
create policy "Users can insert KB for their companies"
  on knowledge_bases for insert
  with check (company_id in (select company_id from memberships where user_id = auth.uid()));
```
