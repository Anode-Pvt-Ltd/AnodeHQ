"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Textarea } from "@/components/primitives/Field";
import { saveSetting } from "@/lib/mutations/settings";

interface Setting {
  key: string;
  value: unknown;
  group: string;
  help: string;
}

const GROUP_LABEL: Record<string, string> = {
  hero: "Homepage hero",
  copy: "Section copy",
  contact: "Contact details",
  social: "Social links",
  seo: "SEO defaults",
  features: "Feature flags",
};

export function SettingsEditor({
  settings,
  databaseReady,
}: {
  settings: Setting[];
  databaseReady: boolean;
}) {
  const groups = Array.from(new Set(settings.map((s) => s.group)));

  if (!settings.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-body-sm text-fg-subtle">
        {databaseReady
          ? "No settings rows yet. Load supabase/seed.sql to populate them."
          : "Settings live in the database. The site is currently reading them from src/content/site.ts."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {groups.map((group) => (
        <section key={group} className="rounded-xl border border-border bg-surface p-5 lg:p-6">
          <h2 className="text-h4 mb-4 text-fg">{GROUP_LABEL[group] ?? group}</h2>
          <div className="flex flex-col gap-5">
            {settings.filter((s) => s.group === group).map((s) => (
              <SettingRow key={s.key} setting={s} disabled={!databaseReady} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingRow({ setting, disabled }: { setting: Setting; disabled: boolean }) {
  const initial = JSON.stringify(setting.value, null, 2);
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const dirty = value !== initial;
  const id = `s-${setting.key.replace(/\./g, "-")}`;
  const isSimple = typeof setting.value === "string";

  const save = () => {
    startTransition(async () => {
      const res = await saveSetting(setting.key, value);
      toast[res.ok ? "success" : "error"](res.message ?? "");
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-[0.8125rem] font-medium text-fg">
        {setting.key}
      </label>
      {setting.help && <p className="text-[0.8125rem] leading-snug text-fg-subtle">{setting.help}</p>}
      <Textarea
        id={id}
        rows={isSimple ? 2 : Math.min(14, initial.split("\n").length + 1)}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        className="font-mono text-[0.8125rem]"
        spellCheck={false}
      />
      {dirty && (
        <div className="flex items-center gap-3">
          <Button size="sm" icon={Save} iconPosition="start" loading={pending} onClick={save} disabled={disabled}>
            Save
          </Button>
          <button
            type="button"
            onClick={() => setValue(initial)}
            className="text-body-sm text-fg-muted hover:text-fg"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
