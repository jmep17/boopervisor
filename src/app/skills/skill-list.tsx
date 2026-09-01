import {
  MasterDetail,
  type MasterDetailItem,
} from "@/components/items/master-detail";
import { ItemStateControls } from "@/components/items/item-state-controls";
import { itemState, whyDisabled } from "@/lib/items";
import { readProjectScopeSkills, readUserScopeSkills } from "@/lib/skills/read";
import { captureFileSnapshot, encodeExpectedFile } from "@/lib/config/mutate";
import {
  resolveEffectiveSettings,
  settingFilePath,
  type SettingsLocation,
} from "@/lib/config/settings";
import { archivedItemsPath } from "@/lib/items/item-state";
import { getSelectedScope } from "@/lib/scope/server";
import { SCOPE_LABELS } from "@/components/settings/scope-labels";
import { changeItemState } from "@/lib/items/actions";

/**
 * The skills the selected scope sees: ~/.claude/skills for the user scope,
 * a project's .claude/skills for a project. Their metadata is shown as it is on
 * disk and never written; only their state changes.
 */
export async function SkillList({
  selectedId,
  showArchived,
}: {
  selectedId?: string;
  showArchived: boolean;
}) {
  const selected = await getSelectedScope();
  const projectRoot = selected.kind === "project" ? selected.path : undefined;
  const location: SettingsLocation = { projectRoot };
  const scope = selected.kind === "project" ? "project" : "user";

  const configurations =
    projectRoot === undefined
      ? await readUserScopeSkills()
      : await readProjectScopeSkills(projectRoot);

  const resolution = await resolveEffectiveSettings(location);

  const expectedSettings = encodeExpectedFile(
    await captureFileSnapshot(settingFilePath(scope, location))
  );
  const expectedArchive = encodeExpectedFile(
    await captureFileSnapshot(archivedItemsPath())
  );

  const skills = await Promise.all(
    Object.entries(configurations).map(async ([name, skill]) => ({
      name,
      skill,
      state: await itemState("skill", name, scope, resolution, projectRoot),
      disabledBy: whyDisabled("skill", name, scope, resolution),
    }))
  );

  const items: MasterDetailItem[] = skills.map((skill) => ({
    id: skill.name,
    label: skill.name,
    state: skill.state,
  }));

  const skill = skills.find((candidate) => candidate.name === selectedId);

  return (
    <MasterDetail
      items={items}
      selectedId={selectedId}
      showArchived={showArchived}
      empty={
        projectRoot
          ? "This project's .claude/skills directory contains no skills."
          : "~/.claude/skills contains no skills."
      }
    >
      {skill ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-gray-1000">{skill.name}</h2>
            <p className="font-mono text-xs text-gray-900">
              {skill.skill.path}/SKILL.md
            </p>
          </div>

          <ItemStateControls
            state={skill.state}
            action={changeItemState}
            fields={{
              type: "skill",
              name: skill.name,
              expectedSettings,
              expectedArchive,
            }}
            lockedReason={
              skill.disabledBy && skill.disabledBy !== scope
                ? `${SCOPE_LABELS[skill.disabledBy]} settings disable this skill, and win over ${SCOPE_LABELS[scope].toLowerCase()} settings.`
                : undefined
            }
          />

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-gray-1000">Metadata</h3>
            <pre className="overflow-x-auto rounded-base border border-gray-alpha-400 bg-background-200 p-3 font-mono text-sm text-gray-1000">
              {JSON.stringify(skill.skill.metadata, null, 2)}
            </pre>
            <p className="text-sm text-gray-900">
              Boopervisor manages this skill&apos;s state, not its metadata.
              Edit the SKILL.md file to change its name or description.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-900">Select a skill.</p>
      )}
    </MasterDetail>
  );
}
