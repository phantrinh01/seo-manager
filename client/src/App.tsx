import {
useEffect,
useMemo,
useState,
type FormEvent,
type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

type Project = ApiResponse<typeof api, "listProjects">["projects"][number];
type Keyword = ApiResponse<typeof api, "listKeywords">["keywords"][number];
type Article = ApiResponse<typeof api, "listArticles">["articles"][number];
type Backlink = ApiResponse<typeof api, "listBacklinks">["backlinks"][number];

type Tab = "overview" | "keywords" | "articles" | "backlinks";

const INTENT_LABELS: Record<Keyword["intent"], string> = {
  informational: "Thông tin",
  commercial: "Thương mại",
  transactional: "Giao dịch",
  navigational: "Điều hướng",
};

const ARTICLE_STATUS_LABELS: Record<Article["status"], string> = {
  idea: "Ý tưởng",
  drafting: "Đang viết",
  review: "Chờ duyệt",
  published: "Đã xuất bản",
};

const BACKLINK_TYPE_LABELS: Record<Backlink["type"], string> = {
  guest_post: "Guest post",
  social: "Social",
  forum: "Forum / Diễn đàn",
  pr: "Báo chí / PR",
  other: "Khác",
};

const BACKLINK_STATUS_LABELS: Record<Backlink["status"], string> = {
  live: "Đang sống",
  pending: "Chờ duyệt",
  lost: "Đã mất",
};

const inputCls =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const btnPrimary =
  "rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50 dark:text-[#12160f]";
const btnGhost =
  "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] transition hover:bg-[var(--surface-alt)] disabled:opacity-50";
const btnDanger =
  "rounded-[var(--radius)] bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("vi-VN");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y = "", m = "", d = ""] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

function parseOptInt(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/[.\s]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Đã có lỗi xảy ra, thử lại nhé.";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-[var(--dim)] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full px-2 py-1 text-xl leading-none text-[var(--dim)] hover:bg-[var(--surface-alt)]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-[var(--text)]">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>
          Huỷ
        </button>
        <button
          type="button"
          className={btnDanger}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Đang xoá…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {errText(error)}
    </p>
  );
}

function PositionBadge({ position }: { position: number | null }) {
  if (position == null) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-semibold text-[var(--dim)]">
        Chưa có hạng
      </span>
    );
  }
  const cls =
    position <= 3
      ? "bg-[var(--accent)] text-white dark:text-[#12160f]"
      : position <= 10
        ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        : position <= 50
          ? "bg-[var(--amber-soft)] text-[var(--amber)]"
          : "bg-[var(--surface-alt)] text-[var(--dim)]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}
    >
      #{position}
    </span>
  );
}

function DifficultyBar({ value }: { value: number }) {
  const color =
    value < 30
      ? "var(--accent)"
      : value < 60
        ? "var(--amber)"
        : "var(--danger)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-alt)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </span>
      <span className="text-xs text-[var(--dim)]">KD {value}</span>
    </span>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "gray";
  children: ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : tone === "amber"
        ? "bg-[var(--amber-soft)] text-[var(--amber)]"
        : tone === "red"
          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
          : "bg-[var(--surface-alt)] text-[var(--dim)]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function articleStatusTone(s: Article["status"]): "green" | "amber" | "gray" {
  if (s === "published") return "green";
  if (s === "review") return "amber";
  return "gray";
}

function backlinkStatusTone(s: Backlink["status"]): "green" | "amber" | "red" {
  if (s === "live") return "green";
  if (s === "pending") return "amber";
  return "red";
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center">
      <p className="font-display text-base font-bold text-[var(--text)]">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--dim)]">{body}</p>
      <button type="button" className={`${btnPrimary} mt-4`} onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

function RowActions({
  itemLabel,
  onEdit,
  onDelete,
}: {
  itemLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
        aria-label={`Sửa ${itemLabel}`}
        onClick={onEdit}
      >
        Sửa
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        aria-label={`Xoá ${itemLabel}`}
        onClick={onDelete}
      >
        Xoá
      </button>
    </span>
  );
}

// ---------------- Forms ----------------

type KeywordValues = {
  keyword: string;
  cluster: string;
  intent: Keyword["intent"];
  volume: number | null;
  difficulty: number | null;
  position: number | null;
  targetUrl: string;
  notes: string;
};

function KeywordForm({
  initial,
  clusters,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initial?: Keyword;
  clusters: string[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (v: KeywordValues) => void;
}) {
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [cluster, setCluster] = useState(initial?.cluster ?? "");
  const [intent, setIntent] = useState<Keyword["intent"]>(
    initial?.intent ?? "informational",
  );
  const [volume, setVolume] = useState(
    initial?.volume != null ? String(initial.volume) : "",
  );
  const [difficulty, setDifficulty] = useState(
    initial?.difficulty != null ? String(initial.difficulty) : "",
  );
  const [position, setPosition] = useState(
    initial?.position != null ? String(initial.position) : "",
  );
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      keyword: keyword.trim(),
      cluster: cluster.trim(),
      intent,
      volume: parseOptInt(volume),
      difficulty: parseOptInt(difficulty),
      position: parseOptInt(position),
      targetUrl: targetUrl.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <Modal
      title={initial ? "Sửa từ khoá" : "Thêm từ khoá"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Từ khoá *">
          <input
            className={inputCls}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            required
            placeholder="vd: lắp đặt camera"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nhóm / Cluster">
            <input
              className={inputCls}
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
              placeholder="vd: Camera trọn gói"
              list="cluster-suggestions"
            />
            <datalist id="cluster-suggestions">
              {clusters.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Ý định tìm kiếm">
            <select
              className={inputCls}
              value={intent}
              onChange={(e) => setIntent(e.target.value as Keyword["intent"])}
            >
              {(
                Object.keys(INTENT_LABELS) as Array<Keyword["intent"]>
              ).map((k) => (
                <option key={k} value={k}>
                  {INTENT_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Volume / tháng">
            <input
              className={inputCls}
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              inputMode="numeric"
              placeholder="vd: 2400"
            />
          </Field>
          <Field label="Độ khó (0–100)">
            <input
              className={inputCls}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              inputMode="numeric"
              placeholder="vd: 35"
            />
          </Field>
          <Field label="Vị trí hiện tại">
            <input
              className={inputCls}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              inputMode="numeric"
              placeholder="vd: 8"
            />
          </Field>
        </div>
        <Field label="URL đích">
          <input
            className={inputCls}
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Ghi chú">
          <textarea
            className={inputCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </Field>
        <FormError error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Thêm từ khoá"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ArticleValues = {
  title: string;
  url: string;
  keywordId: number | null;
  status: Article["status"];
  author: string;
  wordCount: number | null;
  publishDate: string | null;
  notes: string;
};

function ArticleForm({
  initial,
  keywords,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initial?: Article;
  keywords: Keyword[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (v: ArticleValues) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [keywordId, setKeywordId] = useState<string>(
    initial?.keywordId != null ? String(initial.keywordId) : "",
  );
  const [status, setStatus] = useState<Article["status"]>(
    initial?.status ?? "idea",
  );
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [wordCount, setWordCount] = useState(
    initial?.wordCount != null ? String(initial.wordCount) : "",
  );
  const [publishDate, setPublishDate] = useState(initial?.publishDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      url: url.trim(),
      keywordId: keywordId ? Number(keywordId) : null,
      status,
      author: author.trim(),
      wordCount: parseOptInt(wordCount),
      publishDate: publishDate ? publishDate : null,
      notes: notes.trim(),
    });
  }

  return (
    <Modal
      title={initial ? "Sửa bài viết" : "Thêm bài viết"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tiêu đề bài viết *">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="URL bài viết">
          <input
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Từ khoá mục tiêu">
            <select
              className={inputCls}
              value={keywordId}
              onChange={(e) => setKeywordId(e.target.value)}
            >
              <option value="">— Chưa gắn —</option>
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select
              className={inputCls}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as Article["status"])
              }
            >
              {(
                Object.keys(ARTICLE_STATUS_LABELS) as Array<Article["status"]>
              ).map((k) => (
                <option key={k} value={k}>
                  {ARTICLE_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Người viết">
            <input
              className={inputCls}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </Field>
          <Field label="Số từ">
            <input
              className={inputCls}
              value={wordCount}
              onChange={(e) => setWordCount(e.target.value)}
              inputMode="numeric"
              placeholder="vd: 1500"
            />
          </Field>
          <Field label="Ngày xuất bản">
            <input
              className={inputCls}
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Ghi chú">
          <textarea
            className={inputCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </Field>
        <FormError error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Thêm bài viết"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type BacklinkValues = {
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  type: Backlink["type"];
  dofollow: boolean;
  status: Backlink["status"];
  cost: number | null;
  acquiredDate: string | null;
  notes: string;
};

function BacklinkForm({
  initial,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initial?: Backlink;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (v: BacklinkValues) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? "");
  const [anchor, setAnchor] = useState(initial?.anchor ?? "");
  const [type, setType] = useState<Backlink["type"]>(initial?.type ?? "other");
  const [dofollow, setDofollow] = useState(initial?.dofollow ?? true);
  const [status, setStatus] = useState<Backlink["status"]>(
    initial?.status ?? "live",
  );
  const [cost, setCost] = useState(
    initial?.cost != null ? String(initial.cost) : "",
  );
  const [acquiredDate, setAcquiredDate] = useState(
    initial?.acquiredDate ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      sourceUrl: sourceUrl.trim(),
      targetUrl: targetUrl.trim(),
      anchor: anchor.trim(),
      type,
      dofollow,
      status,
      cost: parseOptInt(cost),
      acquiredDate: acquiredDate ? acquiredDate : null,
      notes: notes.trim(),
    });
  }

  return (
    <Modal
      title={initial ? "Sửa backlink" : "Thêm backlink"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="URL nguồn (trang đặt link) *">
          <input
            className={inputCls}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required
            placeholder="https://trang-nguon.vn/bai-viet"
            autoFocus
          />
        </Field>
        <Field label="URL đích (trang của bạn được trỏ tới)">
          <input
            className={inputCls}
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Anchor text">
          <input
            className={inputCls}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Loại backlink">
            <select
              className={inputCls}
              value={type}
              onChange={(e) => setType(e.target.value as Backlink["type"])}
            >
              {(
                Object.keys(BACKLINK_TYPE_LABELS) as Array<Backlink["type"]>
              ).map((k) => (
                <option key={k} value={k}>
                  {BACKLINK_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select
              className={inputCls}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as Backlink["status"])
              }
            >
              {(
                Object.keys(BACKLINK_STATUS_LABELS) as Array<
                  Backlink["status"]
                >
              ).map((k) => (
                <option key={k} value={k}>
                  {BACKLINK_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chi phí (VNĐ)">
            <input
              className={inputCls}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="numeric"
              placeholder="vd: 500000"
            />
          </Field>
          <Field label="Ngày có link">
            <input
              className={inputCls}
              type="date"
              value={acquiredDate}
              onChange={(e) => setAcquiredDate(e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={dofollow}
            onChange={(e) => setDofollow(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Link dofollow (bỏ chọn = nofollow)
        </label>
        <Field label="Ghi chú">
          <textarea
            className={inputCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </Field>
        <FormError error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Thêm backlink"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectForm({
  initial,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initial?: Project;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (v: { name: string; domain: string; status: Project["status"] }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [status, setStatus] = useState<Project["status"]>(
    initial?.status ?? "active",
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), domain: domain.trim(), status });
  }

  return (
    <Modal title={initial ? "Sửa dự án" : "Tạo dự án SEO"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tên dự án *">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="vd: Website Camera An Phát"
            autoFocus
          />
        </Field>
        <Field label="Tên miền">
          <input
            className={inputCls}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="vd: cameraanphat.vn"
          />
        </Field>
        <Field label="Trạng thái">
          <select
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as Project["status"])}
          >
            <option value="active">Đang chạy</option>
            <option value="paused">Tạm dừng</option>
          </select>
        </Field>
        <FormError error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Tạo dự án"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------- Sections ----------------

function KeywordsSection({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [deleting, setDeleting] = useState<Keyword | null>(null);

  const q = useQuery({
    queryKey: ["keywords", projectId],
    queryFn: () => api.listKeywords({ projectId }),
  });
  const keywords = q.data?.keywords ?? [];

  const clusters = useMemo(
    () =>
      Array.from(new Set(keywords.map((k) => k.cluster).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "vi"),
      ),
    [keywords],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return keywords.filter((k) => {
      if (clusterFilter !== "all" && (k.cluster || "") !== clusterFilter)
        return false;
      if (
        s &&
        !k.keyword.toLowerCase().includes(s) &&
        !k.cluster.toLowerCase().includes(s)
      )
        return false;
      return true;
    });
  }, [keywords, search, clusterFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, Keyword[]>();
    for (const k of filtered) {
      const key = k.cluster || "Chưa phân nhóm";
      const arr = map.get(key) ?? [];
      arr.push(k);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "vi"),
    );
  }, [filtered]);

  const create = useMutation({
    mutationFn: (v: KeywordValues) =>
      api.createKeyword({ projectId, ...v }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowForm(false);
    },
  });
  const update = useMutation({
    mutationFn: (v: KeywordValues & { id: number }) => api.updateKeyword(v),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteKeyword({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDeleting(null);
    },
  });

  if (q.isPending) return <p className="py-8 text-sm text-[var(--dim)]">Đang tải từ khoá…</p>;
  if (q.error)
    return (
      <p role="alert" className="py-8 text-sm text-[var(--danger)]">
        Không tải được danh sách từ khoá. {errText(q.error)}
      </p>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} min-w-44 flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm từ khoá hoặc nhóm…"
          aria-label="Tìm từ khoá"
        />
        <select
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value)}
          aria-label="Lọc theo nhóm từ khoá"
        >
          <option value="all">Tất cả nhóm</option>
          {clusters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="">Chưa phân nhóm</option>
        </select>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setShowForm(true)}
        >
          + Thêm từ khoá
        </button>
      </div>

      {keywords.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Chưa có từ khoá nào"
            body="Thêm các từ khoá mục tiêu của dự án, phân nhóm theo topic cluster và theo dõi vị trí trên Google."
            actionLabel="Thêm từ khoá đầu tiên"
            onAction={() => setShowForm(true)}
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--dim)]">
          Không có từ khoá nào khớp với bộ lọc.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(([groupName, items]) => (
            <section key={groupName} aria-label={`Nhóm ${groupName}`}>
              <h3 className="font-display mb-2 text-sm font-bold tracking-wide text-[var(--accent-strong)] uppercase">
                {groupName}
                <span className="ml-2 font-normal text-[var(--dim)] normal-case">
                  ({items.length} từ khoá)
                </span>
              </h3>
              <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                {items.map((k) => (
                  <li key={k.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-medium break-words text-[var(--text)]">
                        {k.keyword}
                      </p>
                      <span className="flex shrink-0 items-center gap-1">
                        <PositionBadge position={k.position} />
                        <RowActions
                          itemLabel={`từ khoá ${k.keyword}`}
                          onEdit={() => setEditing(k)}
                          onDelete={() => setDeleting(k)}
                        />
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dim)]">
                      <span>{INTENT_LABELS[k.intent]}</span>
                      <span>Volume: {fmtNum(k.volume)}/tháng</span>
                      {k.difficulty != null && (
                        <DifficultyBar value={k.difficulty} />
                      )}
                      {k.targetUrl && (
                        <a
                          href={k.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="max-w-full truncate text-[var(--accent-strong)] underline"
                        >
                          {domainOf(k.targetUrl)}
                        </a>
                      )}
                    </div>
                    {k.notes && (
                      <p className="mt-1 text-xs text-[var(--dim)]">{k.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {showForm && (
        <KeywordForm
          clusters={clusters}
          pending={create.isPending}
          error={create.error}
          onClose={() => setShowForm(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      )}
      {editing && (
        <KeywordForm
          initial={editing}
          clusters={clusters}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={(v) => update.mutate({ ...v, id: editing.id })}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Xoá từ khoá?"
          body={`Xoá từ khoá “${deleting.keyword}” khỏi dự án? Các bài viết đang gắn từ khoá này sẽ bị gỡ liên kết.`}
          confirmLabel="Xoá từ khoá"
          pending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
        />
      )}
    </div>
  );
}

function ArticlesSection({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState<Article | null>(null);

  const q = useQuery({
    queryKey: ["articles", projectId],
    queryFn: () => api.listArticles({ projectId }),
  });
  const kwq = useQuery({
    queryKey: ["keywords", projectId],
    queryFn: () => api.listKeywords({ projectId }),
  });
  const articles = q.data?.articles ?? [];
  const keywords = kwq.data?.keywords ?? [];
  const kwById = useMemo(
    () => new Map(keywords.map((k) => [k.id, k])),
    [keywords],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.status, (m.get(a.status) ?? 0) + 1);
    return m;
  }, [articles]);

  const filtered =
    statusFilter === "all"
      ? articles
      : articles.filter((a) => a.status === statusFilter);

  const create = useMutation({
    mutationFn: (v: ArticleValues) =>
      api.createArticle({ projectId, ...v }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowForm(false);
    },
  });
  const update = useMutation({
    mutationFn: (v: ArticleValues & { id: number }) => api.updateArticle(v),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteArticle({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDeleting(null);
    },
  });

  if (q.isPending) return <p className="py-8 text-sm text-[var(--dim)]">Đang tải bài viết…</p>;
  if (q.error)
    return (
      <p role="alert" className="py-8 text-sm text-[var(--danger)]">
        Không tải được danh sách bài viết. {errText(q.error)}
      </p>
    );

  const filterChips: Array<{ key: string; label: string }> = [
    { key: "all", label: `Tất cả (${articles.length})` },
    ...(
      Object.keys(ARTICLE_STATUS_LABELS) as Array<Article["status"]>
    ).map((s) => ({
      key: s,
      label: `${ARTICLE_STATUS_LABELS[s]} (${counts.get(s) ?? 0})`,
    })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo trạng thái bài viết">
          {filterChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              aria-pressed={statusFilter === c.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === c.key
                  ? "bg-[var(--accent)] text-white dark:text-[#12160f]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${btnPrimary} ml-auto`}
          onClick={() => setShowForm(true)}
        >
          + Thêm bài viết
        </button>
      </div>

      {articles.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Chưa có bài viết nào"
            body="Lên kế hoạch nội dung cho dự án: gắn mỗi bài viết với một từ khoá mục tiêu và theo dõi từ khâu ý tưởng đến khi xuất bản."
            actionLabel="Thêm bài viết đầu tiên"
            onAction={() => setShowForm(true)}
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--dim)]">
          Chưa có bài viết nào ở trạng thái này.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          {filtered.map((a) => {
            const kw = a.keywordId != null ? kwById.get(a.keywordId) : undefined;
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium break-words text-[var(--text)]">
                    {a.title}
                  </p>
                  <span className="flex shrink-0 items-center gap-1">
                    <StatusBadge tone={articleStatusTone(a.status)}>
                      {ARTICLE_STATUS_LABELS[a.status]}
                    </StatusBadge>
                    <RowActions
                      itemLabel={`bài viết ${a.title}`}
                      onEdit={() => setEditing(a)}
                      onDelete={() => setDeleting(a)}
                    />
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dim)]">
                  {kw && <span>Từ khoá: {kw.keyword}</span>}
                  {a.author && <span>Người viết: {a.author}</span>}
                  {a.wordCount != null && <span>{fmtNum(a.wordCount)} từ</span>}
                  {a.publishDate && (
                    <span>Xuất bản: {fmtDate(a.publishDate)}</span>
                  )}
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-full truncate text-[var(--accent-strong)] underline"
                    >
                      {domainOf(a.url)}
                    </a>
                  )}
                </div>
                {a.notes && (
                  <p className="mt-1 text-xs text-[var(--dim)]">{a.notes}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <ArticleForm
          keywords={keywords}
          pending={create.isPending}
          error={create.error}
          onClose={() => setShowForm(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      )}
      {editing && (
        <ArticleForm
          initial={editing}
          keywords={keywords}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={(v) => update.mutate({ ...v, id: editing.id })}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Xoá bài viết?"
          body={`Xoá bài viết “${deleting.title}” khỏi dự án?`}
          confirmLabel="Xoá bài viết"
          pending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
        />
      )}
    </div>
  );
}

function BacklinksSection({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Backlink | null>(null);
  const [deleting, setDeleting] = useState<Backlink | null>(null);

  const q = useQuery({
    queryKey: ["backlinks", projectId],
    queryFn: () => api.listBacklinks({ projectId }),
  });
  const backlinks = q.data?.backlinks ?? [];

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of backlinks) m.set(b.status, (m.get(b.status) ?? 0) + 1);
    return m;
  }, [backlinks]);
  const totalCost = useMemo(
    () => backlinks.reduce((s, b) => s + (b.cost ?? 0), 0),
    [backlinks],
  );

  const filtered =
    statusFilter === "all"
      ? backlinks
      : backlinks.filter((b) => b.status === statusFilter);

  const create = useMutation({
    mutationFn: (v: BacklinkValues) =>
      api.createBacklink({ projectId, ...v }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowForm(false);
    },
  });
  const update = useMutation({
    mutationFn: (v: BacklinkValues & { id: number }) => api.updateBacklink(v),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteBacklink({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDeleting(null);
    },
  });

  if (q.isPending) return <p className="py-8 text-sm text-[var(--dim)]">Đang tải backlink…</p>;
  if (q.error)
    return (
      <p role="alert" className="py-8 text-sm text-[var(--danger)]">
        Không tải được danh sách backlink. {errText(q.error)}
      </p>
    );

  const filterChips: Array<{ key: string; label: string }> = [
    { key: "all", label: `Tất cả (${backlinks.length})` },
    ...(
      Object.keys(BACKLINK_STATUS_LABELS) as Array<Backlink["status"]>
    ).map((s) => ({
      key: s,
      label: `${BACKLINK_STATUS_LABELS[s]} (${counts.get(s) ?? 0})`,
    })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo trạng thái backlink">
          {filterChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              aria-pressed={statusFilter === c.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === c.key
                  ? "bg-[var(--accent)] text-white dark:text-[#12160f]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${btnPrimary} ml-auto`}
          onClick={() => setShowForm(true)}
        >
          + Thêm backlink
        </button>
      </div>

      {backlinks.length > 0 && (
        <p className="mt-3 text-sm text-[var(--dim)]">
          Tổng chi phí backlink đã ghi nhận:{" "}
          <strong className="text-[var(--text)]">
            {fmtNum(totalCost)} VNĐ
          </strong>
        </p>
      )}

      {backlinks.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Chưa có backlink nào"
            body="Ghi lại các backlink đã đi cho dự án: nguồn đặt link, anchor text, chi phí và trạng thái để kịp phát hiện link bị mất."
            actionLabel="Thêm backlink đầu tiên"
            onAction={() => setShowForm(true)}
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--dim)]">
          Chưa có backlink nào ở trạng thái này.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          {filtered.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={b.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 font-medium break-all text-[var(--accent-strong)] underline"
                >
                  {domainOf(b.sourceUrl)}
                </a>
                <span className="flex shrink-0 items-center gap-1">
                  <StatusBadge tone={backlinkStatusTone(b.status)}>
                    {BACKLINK_STATUS_LABELS[b.status]}
                  </StatusBadge>
                  <RowActions
                    itemLabel={`backlink từ ${domainOf(b.sourceUrl)}`}
                    onEdit={() => setEditing(b)}
                    onDelete={() => setDeleting(b)}
                  />
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dim)]">
                <span>{BACKLINK_TYPE_LABELS[b.type]}</span>
                <span>{b.dofollow ? "Dofollow" : "Nofollow"}</span>
                {b.anchor && <span>Anchor: “{b.anchor}”</span>}
                {b.cost != null && <span>{fmtNum(b.cost)} VNĐ</span>}
                {b.acquiredDate && <span>Ngày: {fmtDate(b.acquiredDate)}</span>}
              </div>
              {b.targetUrl && (
                <p className="mt-1 truncate text-xs text-[var(--dim)]">
                  Trỏ tới:{" "}
                  <a
                    href={b.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-strong)] underline"
                  >
                    {b.targetUrl}
                  </a>
                </p>
              )}
              {b.notes && (
                <p className="mt-1 text-xs text-[var(--dim)]">{b.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <BacklinkForm
          pending={create.isPending}
          error={create.error}
          onClose={() => setShowForm(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      )}
      {editing && (
        <BacklinkForm
          initial={editing}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={(v) => update.mutate({ ...v, id: editing.id })}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Xoá backlink?"
          body={`Xoá backlink từ ${domainOf(deleting.sourceUrl)} khỏi dự án?`}
          confirmLabel="Xoá backlink"
          pending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
        />
      )}
    </div>
  );
}

// ---------------- Overview ----------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-[var(--dim)] uppercase">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl font-bold text-[var(--text)]">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--dim)]">{sub}</p>}
    </div>
  );
}

function OverviewSection({
  projectId,
  onNavigate,
}: {
  projectId: number;
  onNavigate: (t: Tab) => void;
}) {
  const dash = useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => api.getDashboard({ projectId }),
  });
  const kwq = useQuery({
    queryKey: ["keywords", projectId],
    queryFn: () => api.listKeywords({ projectId }),
  });
  const artq = useQuery({
    queryKey: ["articles", projectId],
    queryFn: () => api.listArticles({ projectId }),
  });
  const blq = useQuery({
    queryKey: ["backlinks", projectId],
    queryFn: () => api.listBacklinks({ projectId }),
  });

  if (dash.isPending)
    return <p className="py-8 text-sm text-[var(--dim)]">Đang tải tổng quan…</p>;
  if (dash.error || !dash.data)
    return (
      <p role="alert" className="py-8 text-sm text-[var(--danger)]">
        Không tải được số liệu tổng quan.{" "}
        {dash.error ? errText(dash.error) : ""}
      </p>
    );

  const d = dash.data;
  const keywords = kwq.data?.keywords ?? [];
  const articles = artq.data?.articles ?? [];
  const backlinks = blq.data?.backlinks ?? [];

  const buckets = [
    { label: "Top 3", count: d.top3, color: "var(--accent)" },
    { label: "Top 4–10", count: d.top10 - d.top3, color: "#4ade80" },
    { label: "Top 11–100", count: d.top100 - d.top10, color: "var(--amber)" },
    { label: "Chưa có hạng", count: d.unranked, color: "var(--border)" },
  ];
  const totalKw = Math.max(d.keywordCount, 1);

  const topKeywords = [...keywords]
    .filter((k) => k.position != null)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, 5);
  const pipeline = articles
    .filter((a) => a.status !== "published")
    .slice(0, 5);
  const lostLinks = backlinks.filter((b) => b.status === "lost").slice(0, 5);

  const isEmpty =
    d.keywordCount === 0 && d.articleCount === 0 && d.backlinkCount === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tổng từ khoá"
          value={fmtNum(d.keywordCount)}
          sub={`${fmtNum(d.top10)} từ khoá trong top 10`}
        />
        <StatCard
          label="Từ khoá top 3"
          value={fmtNum(d.top3)}
          sub={
            d.keywordCount > 0
              ? `${Math.round((d.top3 / d.keywordCount) * 100)}% tổng số từ khoá`
              : "Chưa có dữ liệu"
          }
        />
        <StatCard
          label="Bài viết đã xuất bản"
          value={`${fmtNum(d.publishedCount)}/${fmtNum(d.articleCount)}`}
          sub={`${fmtNum(d.articleCount - d.publishedCount)} bài đang trong quy trình`}
        />
        <StatCard
          label="Backlink đang sống"
          value={fmtNum(d.liveBacklinks)}
          sub={`${fmtNum(d.lostBacklinks)} đã mất · ${fmtNum(d.pendingBacklinks)} chờ duyệt · Chi phí ${fmtNum(d.backlinkCost)} VNĐ`}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Dự án chưa có dữ liệu"
          body="Bắt đầu bằng cách thêm từ khoá mục tiêu, lên kế hoạch bài viết và ghi lại các backlink đã đi cho dự án này."
          actionLabel="Thêm từ khoá đầu tiên"
          onAction={() => onNavigate("keywords")}
        />
      ) : (
        <>
          <section aria-label="Phân bố thứ hạng từ khoá">
            <h3 className="font-display mb-2 text-base font-bold text-[var(--text)]">
              Phân bố thứ hạng
            </h3>
            <div
              className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]"
              role="img"
              aria-label={buckets
                .map((b) => `${b.label}: ${b.count}`)
                .join(", ")}
            >
              {buckets.map(
                (b) =>
                  b.count > 0 && (
                    <div
                      key={b.label}
                      style={{
                        width: `${(b.count / totalKw) * 100}%`,
                        backgroundColor: b.color,
                      }}
                    />
                  ),
              )}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dim)]">
              {buckets.map((b) => (
                <li key={b.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: b.color }}
                  />
                  {b.label}: <strong className="text-[var(--text)]">{b.count}</strong>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section aria-label="Từ khoá hạng cao nhất">
              <h3 className="font-display mb-2 text-base font-bold text-[var(--text)]">
                Từ khoá hạng cao nhất
              </h3>
              {topKeywords.length === 0 ? (
                <p className="text-sm text-[var(--dim)]">
                  Chưa có từ khoá nào được ghi nhận vị trí.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                  {topKeywords.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm text-[var(--text)]">
                        {k.keyword}
                      </span>
                      <PositionBadge position={k.position} />
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-[var(--accent-strong)] underline"
                onClick={() => onNavigate("keywords")}
              >
                Xem tất cả từ khoá
              </button>
            </section>

            <section aria-label="Bài viết đang trong quy trình">
              <h3 className="font-display mb-2 text-base font-bold text-[var(--text)]">
                Bài viết đang xử lý
              </h3>
              {pipeline.length === 0 ? (
                <p className="text-sm text-[var(--dim)]">
                  Không có bài viết nào đang trong quy trình.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                  {pipeline.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm text-[var(--text)]">
                        {a.title}
                      </span>
                      <StatusBadge tone={articleStatusTone(a.status)}>
                        {ARTICLE_STATUS_LABELS[a.status]}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-[var(--accent-strong)] underline"
                onClick={() => onNavigate("articles")}
              >
                Xem tất cả bài viết
              </button>
            </section>

            <section aria-label="Backlink đã mất">
              <h3 className="font-display mb-2 text-base font-bold text-[var(--text)]">
                Backlink cần chú ý
              </h3>
              {lostLinks.length === 0 ? (
                <p className="text-sm text-[var(--dim)]">
                  Chưa ghi nhận backlink nào bị mất.{" "}
                  {d.pendingBacklinks > 0 &&
                    `Đang có ${d.pendingBacklinks} backlink chờ duyệt.`}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                  {lostLinks.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm text-[var(--text)]">
                        {domainOf(b.sourceUrl)}
                      </span>
                      <StatusBadge tone="red">Đã mất</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-[var(--accent-strong)] underline"
                onClick={() => onNavigate("backlinks")}
              >
                Xem tất cả backlink
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- App ----------------

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "keywords", label: "Từ khoá" },
  { key: "articles", label: "Bài viết" },
  { key: "backlinks", label: "Backlink" },
];

export function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects({}),
  });
  const projects = projectsQ.data?.projects ?? [];
  const selected =
    projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const dash = useQuery({
    queryKey: ["dashboard", selected?.id ?? 0],
    queryFn: () => api.getDashboard({ projectId: selected?.id ?? 0 }),
    enabled: selected != null,
  });

  const createProject = useMutation({
    mutationFn: (v: { name: string; domain: string; status: Project["status"] }) =>
      api.createProject(v),
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      setShowProjectForm(false);
      setSelectedId(res.id);
      setTab("overview");
    },
  });
  const updateProject = useMutation({
    mutationFn: (v: {
      id: number;
      name: string;
      domain: string;
      status: Project["status"];
    }) => api.updateProject(v),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditingProject(null);
    },
  });
  const deleteProject = useMutation({
    mutationFn: (id: number) => api.deleteProject({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDeletingProject(null);
      setSelectedId(null);
      setTab("overview");
    },
  });

  const tabCounts: Partial<Record<Tab, number>> = dash.data
    ? {
        keywords: dash.data.keywordCount,
        articles: dash.data.articleCount,
        backlinks: dash.data.backlinkCount,
      }
    : {};

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-[env(safe-area-inset-bottom)]">
        {projectsQ.isPending ? (
          <p className="py-12 text-center text-sm text-[var(--dim)]">
            Đang tải dự án…
          </p>
        ) : projectsQ.error ? (
          <p role="alert" className="py-12 text-center text-sm text-[var(--danger)]">
            Không tải được danh sách dự án. {errText(projectsQ.error)}
          </p>
        ) : projects.length === 0 ? (
          <div className="py-10">
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">
              Bắt đầu dự án SEO đầu tiên
            </h1>
            <p className="mt-2 max-w-md text-sm text-[var(--dim)]">
              Mỗi dự án SEO gắn với một website. Trong dự án, bạn quản lý danh
              sách từ khoá theo nhóm chủ đề, tiến độ bài viết và các backlink
              đã đi — tất cả ở một nơi.
            </p>
            <button
              type="button"
              className={`${btnPrimary} mt-5`}
              onClick={() => setShowProjectForm(true)}
            >
              + Tạo dự án SEO
            </button>
          </div>
        ) : (
          selected && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Chọn dự án SEO"
                >
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id);
                        setTab("overview");
                      }}
                      aria-pressed={p.id === selected.id}
                      className={`rounded-full px-3.5 py-2 text-sm font-semibold ${
                        p.id === selected.id
                          ? "bg-[var(--accent-strong)] text-white dark:text-[#12160f]"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      }`}
                    >
                      {p.name}
                      {p.status === "paused" && (
                        <span className="ml-1.5 text-xs font-normal opacity-70">
                          (tạm dừng)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`${btnGhost} ml-auto`}
                  onClick={() => setShowProjectForm(true)}
                >
                  + Dự án mới
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--dim)]">
                {selected.domain && (
                  <span className="font-medium text-[var(--text)]">
                    {selected.domain}
                  </span>
                )}
                <span>
                  {selected.status === "active" ? "Đang chạy" : "Tạm dừng"}
                </span>
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
                    aria-label={`Sửa dự án ${selected.name}`}
                    onClick={() => setEditingProject(selected)}
                  >
                    Sửa dự án
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                    aria-label={`Xoá dự án ${selected.name}`}
                    onClick={() => setDeletingProject(selected)}
                  >
                    Xoá dự án
                  </button>
                </span>
              </div>

              <nav
                className="mt-4 flex flex-wrap gap-1 border-b border-[var(--border)]"
                aria-label="Mục quản lý"
              >
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    aria-current={tab === t.key ? "page" : undefined}
                    className={`border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
                      tab === t.key
                        ? "border-[var(--accent)] text-[var(--accent-strong)]"
                        : "border-transparent text-[var(--dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t.label}
                    {tabCounts[t.key] != null && (
                      <span className="ml-1.5 rounded-full bg-[var(--surface-alt)] px-1.5 py-0.5 text-xs text-[var(--dim)]">
                        {tabCounts[t.key]}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="pt-5 pb-10">
                {tab === "overview" && (
                  <OverviewSection
                    projectId={selected.id}
                    onNavigate={setTab}
                  />
                )}
                {tab === "keywords" && (
                  <KeywordsSection projectId={selected.id} />
                )}
                {tab === "articles" && (
                  <ArticlesSection projectId={selected.id} />
                )}
                {tab === "backlinks" && (
                  <BacklinksSection projectId={selected.id} />
                )}
              </div>
            </>
          )
        )}
      </main>

      {showProjectForm && (
        <ProjectForm
          pending={createProject.isPending}
          error={createProject.error}
          onClose={() => setShowProjectForm(false)}
          onSubmit={(v) => createProject.mutate(v)}
        />
      )}
      {editingProject && (
        <ProjectForm
          initial={editingProject}
          pending={updateProject.isPending}
          error={updateProject.error}
          onClose={() => setEditingProject(null)}
          onSubmit={(v) => updateProject.mutate({ ...v, id: editingProject.id })}
        />
      )}
      {deletingProject && (
        <ConfirmDialog
          title="Xoá dự án?"
          body={`Xoá dự án “${deletingProject.name}” cùng toàn bộ từ khoá, bài viết và backlink trong dự án? Hành động này không thể hoàn tác.`}
          confirmLabel="Xoá dự án"
          pending={deleteProject.isPending}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => deleteProject.mutate(deletingProject.id)}
        />
      )}
    </div>
  );
}
