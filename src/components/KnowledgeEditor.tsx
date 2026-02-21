"use client";

import { useCallback, useState } from "react";
import type { KnowledgeBase, ExtendedKnowledge, KeyPerson } from "@/types/knowledge";

type SectionKey = keyof Omit<KnowledgeBase, "id" | "sourceUrl" | "scrapedAt">;

const SECTION_LABELS: Record<SectionKey, string> = {
  companyFoundation: "Company foundation",
  positioning: "Positioning (pitch & founding story)",
  marketCustomers: "Market & customers",
  brandingStyle: "Branding & style",
  onlinePresence: "Online presence",
  keyPeople: "Key people",
  offerings: "Offerings",
  extended: "Extended",
};

interface KnowledgeEditorProps {
  knowledge: KnowledgeBase;
  onChange: (kb: KnowledgeBase) => void;
}

function EditableSection({
  title,
  children,
  defaultOpen = true,
  collapsible = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  
  if (!collapsible) {
    return (
      <div className="card overflow-hidden">
        <div className="bg-stone-50 px-4 py-3 font-medium text-stone-800 cursor-default">
          {title}
        </div>
        <div className="border-t border-stone-200 p-4">{children}</div>
      </div>
    );
  }
  
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-stone-50 px-4 py-3 text-left font-medium text-stone-800 hover:bg-stone-100"
      >
        {title}
        <span className="text-stone-500">{open ? "▼" : "▶"}</span>
      </button>
      {open && <div className="border-t border-stone-200 p-4">{children}</div>}
    </div>
  );
}

function JsonEditor({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-stone-600">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field min-h-[80px] font-sans text-base leading-relaxed"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field font-sans text-base"
        />
      )}
    </div>
  );
}

export function KnowledgeEditor({ knowledge, onChange }: KnowledgeEditorProps) {
  const update = useCallback(
    (updates: Partial<KnowledgeBase>) => {
      onChange({ ...knowledge, ...updates });
    },
    [knowledge, onChange]
  );

  const cf = knowledge.companyFoundation;
  const setCf = useCallback(
    (v: KnowledgeBase["companyFoundation"]) =>
      update({ companyFoundation: v }),
    [update]
  );

  const pos = knowledge.positioning;
  const setPos = useCallback(
    (v: KnowledgeBase["positioning"]) => update({ positioning: v }),
    [update]
  );

  const mc = knowledge.marketCustomers;
  const setMc = useCallback(
    (v: KnowledgeBase["marketCustomers"]) => update({ marketCustomers: v }),
    [update]
  );

  const bs = knowledge.brandingStyle;
  const setBs = useCallback(
    (v: KnowledgeBase["brandingStyle"]) => update({ brandingStyle: v }),
    [update]
  );

  const op = knowledge.onlinePresence;
  const setOp = useCallback(
    (v: KnowledgeBase["onlinePresence"]) => update({ onlinePresence: v }),
    [update]
  );

  return (
    <div className="space-y-4 font-sans text-stone-800">
      <EditableSection title={SECTION_LABELS.companyFoundation}>
        <JsonEditor
          label="Overview"
          value={cf.overview ?? ""}
          onChange={(v) => setCf({ ...cf, overview: v || undefined })}
          multiline
        />
        <JsonEditor label="Website" value={cf.website ?? ""} onChange={(v) => setCf({ ...cf, website: v || undefined })} />
        <JsonEditor label="Industry" value={cf.industry ?? ""} onChange={(v) => setCf({ ...cf, industry: v || undefined })} />
        <JsonEditor label="Business model" value={cf.businessModel ?? ""} onChange={(v) => setCf({ ...cf, businessModel: v || undefined })} />
        <JsonEditor label="Year founded" value={cf.yearFounded ?? ""} onChange={(v) => setCf({ ...cf, yearFounded: v || undefined })} />
        <JsonEditor label="Employee count" value={cf.employeeCount ?? ""} onChange={(v) => setCf({ ...cf, employeeCount: v || undefined })} />
        <JsonEditor label="Main address" value={cf.mainAddress ?? ""} onChange={(v) => setCf({ ...cf, mainAddress: v || undefined })} />
        <JsonEditor label="Phone" value={cf.phone ?? ""} onChange={(v) => setCf({ ...cf, phone: v || undefined })} />
        <JsonEditor label="Email" value={cf.email ?? ""} onChange={(v) => setCf({ ...cf, email: v || undefined })} />
        <JsonEditor
          label="Alternative names"
          value={(cf.alternativeNames ?? []).join(", ")}
          onChange={(v) =>
            setCf({
              ...cf,
              alternativeNames: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            })
          }
        />
      </EditableSection>

      <EditableSection title={SECTION_LABELS.positioning}>
        <JsonEditor
          label="Company pitch"
          value={pos.companyPitch ?? ""}
          onChange={(v) => setPos({ ...pos, companyPitch: v || undefined })}
          multiline
        />
        <JsonEditor
          label="Founding story"
          value={pos.foundingStory ?? ""}
          onChange={(v) => setPos({ ...pos, foundingStory: v || undefined })}
          multiline
        />
      </EditableSection>

      <EditableSection title={SECTION_LABELS.marketCustomers}>
        <JsonEditor
          label="Target buyers"
          value={(mc.targetBuyers ?? []).join(", ")}
          onChange={(v) =>
            setMc({
              ...mc,
              targetBuyers: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            })
          }
        />
        <JsonEditor label="Ideal customer persona" value={mc.idealCustomerPersona ?? ""} onChange={(v) => setMc({ ...mc, idealCustomerPersona: v || undefined })} multiline />
        <JsonEditor label="Industry outlook" value={mc.industryOutlook ?? ""} onChange={(v) => setMc({ ...mc, industryOutlook: v || undefined })} multiline />
        <JsonEditor
          label="Calls to action"
          value={(mc.ctas ?? []).join(", ")}
          onChange={(v) =>
            setMc({
              ...mc,
              ctas: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            })
          }
        />
      </EditableSection>

      <EditableSection title={SECTION_LABELS.brandingStyle}>
        <JsonEditor
          label="Writing style"
          value={bs.writingStyle ?? ""}
          onChange={(v) => setBs({ ...bs, writingStyle: v || undefined })}
          multiline
        />
        <JsonEditor label="Art style" value={bs.artStyle ?? ""} onChange={(v) => setBs({ ...bs, artStyle: v || undefined })} />
        <JsonEditor
          label="Brand colors"
          value={(bs.brandColors ?? []).join(", ")}
          onChange={(v) =>
            setBs({
              ...bs,
              brandColors: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            })
          }
        />
        <JsonEditor
          label="Logo URLs"
          value={(bs.logoUrls ?? []).join(", ")}
          onChange={(v) =>
            setBs({
              ...bs,
              logoUrls: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            })
          }
        />
      </EditableSection>

      <EditableSection title={SECTION_LABELS.onlinePresence}>
        <JsonEditor label="LinkedIn" value={op.linkedIn ?? ""} onChange={(v) => setOp({ ...op, linkedIn: v || undefined })} />
        <JsonEditor label="Facebook" value={op.facebook ?? ""} onChange={(v) => setOp({ ...op, facebook: v || undefined })} />
        <JsonEditor label="Instagram" value={op.instagram ?? ""} onChange={(v) => setOp({ ...op, instagram: v || undefined })} />
        <JsonEditor label="Twitter/X" value={op.twitterX ?? ""} onChange={(v) => setOp({ ...op, twitterX: v || undefined })} />
        <JsonEditor label="YouTube" value={op.youtube ?? ""} onChange={(v) => setOp({ ...op, youtube: v || undefined })} />
      </EditableSection>

      <EditableSection title={SECTION_LABELS.keyPeople} collapsible={false}>
        <KeyPeopleListEditor
          keyPeople={knowledge.keyPeople}
          onChange={(list) => update({ keyPeople: list })}
        />
      </EditableSection>

      <EditableSection title={SECTION_LABELS.offerings} collapsible={false}>
        <p className="mb-3 text-sm text-stone-600">
          {knowledge.offerings.length} offering(s). Shown as plain text below.
        </p>
        <div className="space-y-3 text-stone-700">
          {knowledge.offerings.map((offering, i) => (
            <p key={i} className="leading-relaxed">
              <span className="font-medium text-stone-800">{offering.name}</span>
              {offering.description ? (
                <> — {offering.description}</>
              ) : (
                "."
              )}
              {offering.features && offering.features.length > 0 && (
                <> {offering.features.slice(0, 5).join(". ")}.</>
              )}
              {offering.pricing && <> {offering.pricing}</>}
            </p>
          ))}
        </div>
      </EditableSection>

      <EditableSection title="Think Bigger (Extended)" collapsible={false}>
        <ExtendedFieldsEditor
          extended={knowledge.extended ?? {}}
          onChange={(ext) => update({ extended: Object.keys(ext).length > 0 ? ext : undefined })}
        />
      </EditableSection>
    </div>
  );
}

/** Key people as plain text: one line per person, e.g. "Name" or "Name – Title". No JSON or brackets. */
function KeyPeopleListEditor({
  keyPeople,
  onChange,
}: {
  keyPeople: KeyPerson[];
  onChange: (list: KeyPerson[]) => void;
}) {
  const byName = new Map(keyPeople.map((p) => [p.name.trim().toLowerCase(), p]));
  const text = keyPeople
    .map((p) => {
      const titlePart = [p.title, p.role].filter(Boolean).join(", ");
      return titlePart ? `${p.name} – ${titlePart}` : p.name;
    })
    .join("\n");

  const handleChange = (value: string) => {
    const lines = value ? value.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    const list: KeyPerson[] = lines.map((line) => {
      const dash = line.indexOf(" – ");
      const namePart = dash >= 0 ? line.slice(0, dash).trim() : line;
      const titlePart = dash >= 0 ? line.slice(dash + 3).trim() : undefined;
      const existing = namePart ? byName.get(namePart.toLowerCase()) : undefined;
      if (existing) {
        return { ...existing, name: existing.name, title: titlePart ?? existing.title };
      }
      return { name: namePart || "Unknown", title: titlePart };
    });
    onChange(list);
  };

  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-stone-600">Names and titles</label>
      <p className="mb-1 text-xs text-stone-500">One person per line. Use "Name – Title" if you want a title shown.</p>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        className="input-field min-h-[100px] font-sans text-base leading-relaxed"
        rows={5}
        placeholder={"Kelly Jones\nThomas Scott – CTO"}
      />
    </div>
  );
}

/** One item per line — shows and edits as plain sentences, not code. */
function ListEditor({
  label,
  hint,
  value,
  onChange,
  multiline = true,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  multiline?: boolean;
}) {
  const text = (value ?? []).join("\n");
  const handleChange = (v: string) =>
    onChange(v ? v.split("\n").map((s) => s.trim()).filter(Boolean) : []);
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-stone-600">{label}</label>
      {hint && <p className="mb-1 text-xs text-stone-500">{hint}</p>}
      {multiline ? (
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          className="input-field min-h-[80px] font-sans text-base leading-relaxed"
          rows={4}
          placeholder="Enter one per line"
        />
      ) : (
        <input
          type="text"
          value={text.replace(/\n/g, ", ")}
          onChange={(e) => handleChange(e.target.value.replace(/,/g, "\n"))}
          className="input-field font-sans text-base"
          placeholder="Enter one per line"
        />
      )}
    </div>
  );
}

function ExtendedFieldsEditor({
  extended,
  onChange,
}: {
  extended: ExtendedKnowledge;
  onChange: (ext: ExtendedKnowledge) => void;
}) {
  const set = (patch: Partial<ExtendedKnowledge>) =>
    onChange({ ...extended, ...patch });

  return (
    <div className="space-y-4 font-sans">
      <ListEditor
        label="Content themes"
        hint="Topics or themes the company often talks about. One per line."
        value={extended.contentThemes ?? []}
        onChange={(v) => set({ contentThemes: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Testimonials and social proof"
        hint="Customer quotes or reviews. One per line."
        value={extended.testimonials ?? []}
        onChange={(v) => set({ testimonials: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Certifications and awards"
        hint="One per line."
        value={extended.certificationsAwards ?? []}
        onChange={(v) => set({ certificationsAwards: v.length > 0 ? v : undefined })}
      />
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-stone-600">Frequently asked questions</label>
        <p className="mb-2 text-xs text-stone-500">
          {(extended.faq ?? []).length} question(s) from the site.
        </p>
        {(extended.faq ?? []).length > 0 ? (
          <ul className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/50 p-4 text-sm leading-relaxed text-stone-700">
            {(extended.faq ?? []).map((item, i) => (
              <li key={i} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                <p className="font-medium text-stone-800">{item.question}</p>
                <p className="mt-1 pl-0 text-stone-600">{item.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">No FAQ extracted yet.</p>
        )}
      </div>
      <ListEditor
        label="Key calls to action and USPs"
        hint="e.g. “Get a free quote”, “Schedule a call”. One per line."
        value={extended.usp ?? []}
        onChange={(v) => set({ usp: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Values and community"
        hint="What they care about. One per line."
        value={extended.valuesCommunity ?? []}
        onChange={(v) => set({ valuesCommunity: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Competitors"
        hint="One per line."
        value={extended.competitors ?? []}
        onChange={(v) => set({ competitors: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Seasonal or time-sensitive messaging"
        hint="One per line."
        value={extended.seasonalMessaging ?? []}
        onChange={(v) => set({ seasonalMessaging: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Legal and compliance"
        hint="One per line."
        value={extended.legalCompliance ?? []}
        onChange={(v) => set({ legalCompliance: v.length > 0 ? v : undefined })}
      />
      <ListEditor
        label="Press and media mentions"
        hint="One per line."
        value={extended.pressMentions ?? []}
        onChange={(v) => set({ pressMentions: v.length > 0 ? v : undefined })}
      />
      <JsonEditor
        label="What the customer gets"
        value={extended.customerGets ?? ""}
        onChange={(v) => set({ customerGets: v || undefined })}
        multiline
      />
    </div>
  );
}
