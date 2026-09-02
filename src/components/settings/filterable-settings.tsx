"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { ProjectFile } from "@/lib/config/editing-scope";
import { matchesQuery, queryTerms } from "@/lib/config/setting-search";
import { SettingsFileSwitch } from "./settings-file-switch";
import { SettingsFilter } from "./settings-filter";

export interface FilterableRow {
  key: string;
  summary?: string;
  /** The server-rendered <SettingRow>. */
  node: ReactNode;
}

export interface FilterableTopic {
  topic: string;
  rows: FilterableRow[];
}

export interface FilterableSettingsProps {
  topics: FilterableTopic[];
  /** Keys on disk the catalog does not describe; empty when there are none. */
  uncatalogued: FilterableRow[];
  /** The `q` search param the page was requested with. */
  initialQuery: string;
  /** Which project settings file is selected; absent at user scope. */
  file?: ProjectFile;
}

/**
 * The search field plus every topic section and the Uncatalogued section. Rows are always
 * rendered; only their visibility changes with the query, so a row's form state survives
 * filtering.
 */
export function FilterableSettings({
  topics,
  uncatalogued,
  initialQuery,
  file,
}: FilterableSettingsProps) {
  const [query, setQuery] = useState(initialQuery);
  const terms = useMemo(() => queryTerms(query), [query]);

  const topicVisibility = topics.map((topic) => {
    const visibleKeys = new Set(
      topic.rows
        .filter((row) =>
          matchesQuery(
            { key: row.key, summary: row.summary, topic: topic.topic },
            terms
          )
        )
        .map((row) => row.key)
    );
    return { topic, visibleKeys };
  });

  const visibleUncatalogued = new Set(
    uncatalogued
      .filter((row) => matchesQuery({ key: row.key }, terms))
      .map((row) => row.key)
  );

  const total =
    topics.reduce((sum, topic) => sum + topic.rows.length, 0) +
    uncatalogued.length;
  const shown =
    topicVisibility.reduce(
      (sum, { visibleKeys }) => sum + visibleKeys.size,
      0
    ) + visibleUncatalogued.size;

  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        if (query.trim() === "") url.searchParams.delete("q");
        else url.searchParams.set("q", query);
        window.history.replaceState(null, "", url);
      } catch {
        // Safari rate-limits history writes; the query still works, it is just not in the URL.
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="flex flex-col gap-10">
      {file ? <SettingsFileSwitch file={file} query={query} /> : null}

      <SettingsFilter
        query={query}
        onQueryChange={setQuery}
        shown={shown}
        total={total}
      />

      {terms.length > 0 && shown === 0 ? (
        <p className="text-sm text-gray-900">
          No setting matches &quot;{query}&quot;.
        </p>
      ) : null}

      {topicVisibility.map(({ topic, visibleKeys }) => (
        <section
          key={topic.topic}
          className="flex flex-col gap-3"
          hidden={visibleKeys.size === 0}
        >
          <h2 className="text-heading-16 font-semibold text-gray-1000">
            {topic.topic}
          </h2>
          <div className="flex flex-col gap-2">
            {topic.rows.map((row) => (
              <div key={row.key} hidden={!visibleKeys.has(row.key)}>
                {row.node}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section
        className="flex flex-col gap-3"
        hidden={uncatalogued.length === 0 || visibleUncatalogued.size === 0}
      >
        <h2 className="flex items-center gap-2 text-heading-16 font-semibold text-gray-1000">
          Uncatalogued
          <span className="font-normal text-sm text-gray-900">
            ({uncatalogued.length})
          </span>
        </h2>
        <p className="max-w-prose text-sm text-gray-900">
          Keys these files hold that the catalog does not describe. Boopervisor
          preserves them exactly as it found them.
        </p>
        <div className="flex flex-col gap-2">
          {uncatalogued.map((row) => (
            <div key={row.key} hidden={!visibleUncatalogued.has(row.key)}>
              {row.node}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
