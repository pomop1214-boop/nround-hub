import Icon from "./Icon";

export type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  place: string | null;
};

const WD = ["일", "월", "화", "수", "목", "금", "토"];

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 시안의 날짜 칩 — 4월 / 10 / 목 */
export function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="nr-datechip">
      <span className="text-[9.5px] font-bold" style={{ color: "var(--red)" }}>
        {d.getMonth() + 1}월
      </span>
      <span
        className="text-[17px] font-extrabold leading-tight"
        style={{ color: "var(--red-deep)" }}
      >
        {d.getDate()}
      </span>
      <span className="text-[9.5px]" style={{ color: "var(--red)" }}>
        {WD[d.getDay()]}
      </span>
    </span>
  );
}

export default function EventList({ events }: { events: EventRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((e) => (
        <div key={e.id} className="nr-card flex items-center gap-3 p-3">
          <DateChip iso={e.starts_at} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
              {e.title}
            </p>
            <p
              className="mt-1 flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              <Icon name="clock" size={12} />
              {hhmm(e.starts_at)}
              {e.ends_at ? ` - ${hhmm(e.ends_at)}` : ""}
            </p>
            {e.place && (
              <p
                className="mt-0.5 flex items-center gap-1.5 truncate text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                <Icon name="pin" size={12} />
                {e.place}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
