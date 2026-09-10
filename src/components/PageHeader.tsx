import { MiniDisc } from "./Icon";

export default function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between pb-4 pt-7">
      <div className="flex items-center gap-3">
        <MiniDisc size={30} />
        <div>
          <p className="nr-h2">{title}</p>
          {sub && <p className="nr-more mt-1">{sub}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}
