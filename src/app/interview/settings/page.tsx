import { requireInterviewManager } from "@/lib/auth/require-user";
import { getTeamContext } from "@/lib/auth/team-context";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { getInterviewTimezone } from "@/lib/settings";
import { listStages, listStatuses, listMeetingTypes } from "@/lib/interview/config";
import { supportedTimeZones } from "@/lib/interview/timezone";
import { TimezoneForm } from "./timezone-form";
import { ConfigListEditor } from "./config-list-editor";
import { StatusListEditor } from "./status-list-editor";
import {
  createStageAction,
  renameStageAction,
  setStageActiveAction,
  moveStageAction,
  createStatusAction,
  updateStatusAction,
  setStatusActiveAction,
  moveStatusAction,
  createMeetingTypeAction,
  renameMeetingTypeAction,
  setMeetingTypeActiveAction,
  moveMeetingTypeAction,
} from "./actions";

export default async function InterviewSettingsPage() {
  await requireInterviewManager();
  const ctx = await getTeamContext();
  const teamId = ctx?.activeTeamId ?? undefined;

  const [timezone, stages, statuses, meetingTypes] = await Promise.all([
    getInterviewTimezone(),
    listStages(true, teamId),
    listStatuses(true, teamId),
    listMeetingTypes(true, teamId),
  ]);

  return (
    <InterviewShell isManager>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Interview Settings"
          description="Configure the timezone and the interview process, status, and meeting-type options."
        />

        <TimezoneForm current={timezone} zones={supportedTimeZones()} />

        <ConfigListEditor
          title="Interview Process stages"
          description="The ordered pipeline shown when scheduling — e.g. Introduce, Technical, Final."
          items={stages}
          onCreate={createStageAction}
          onRename={renameStageAction}
          onToggle={setStageActiveAction}
          onMove={moveStageAction}
        />

        <StatusListEditor
          items={statuses}
          onCreate={createStatusAction}
          onUpdate={updateStatusAction}
          onToggle={setStatusActiveAction}
          onMove={moveStatusAction}
        />

        <ConfigListEditor
          title="Meeting Types"
          description="How the interview happens — e.g. Zoom, Google Meet, Phone, Onsite."
          items={meetingTypes}
          onCreate={createMeetingTypeAction}
          onRename={renameMeetingTypeAction}
          onToggle={setMeetingTypeActiveAction}
          onMove={moveMeetingTypeAction}
        />
      </div>
    </InterviewShell>
  );
}
