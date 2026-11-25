"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronsDownUp, ChevronsUpDown, Maximize, Maximize2, Minimize2, Minus, Plus, Search, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { formatMoney } from "@/lib/format";
import type { HierarchyNode } from "@/lib/affiliates/hierarchy";
import "./orgTree.css";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Ids of every node that has children, and of every ancestor of a node matching the search. */
function index(root: HierarchyNode, query: string) {
  const parents = new Set<string>();
  const open = new Set<string>(); // ancestors of a match: forced open
  const matches = new Set<string>();
  const q = query.trim().toLowerCase();

  function walk(n: HierarchyNode, ancestors: string[], depth: number, depths: Map<string, number>) {
    depths.set(n.id, depth);
    if (n.children.length > 0) parents.add(n.id);
    if (q && (n.name.toLowerCase().includes(q) || n.email?.toLowerCase().includes(q))) {
      matches.add(n.id);
      ancestors.forEach((a) => open.add(a));
    }
    n.children.forEach((c) => walk(c, [...ancestors, n.id], depth + 1, depths));
  }
  const depths = new Map<string, number>();
  walk(root, [], 0, depths);
  return { parents, open, matches, depths };
}

const PILL: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  suspended: "bg-rose-50 text-rose-600",
  rejected: "bg-rose-50 text-rose-600",
};

function NodeCard({
  node,
  admin,
  collapsed,
  onToggle,
  dim,
  hit,
  href,
  onSelect,
  picked,
  dnd,
}: {
  node: HierarchyNode;
  admin: boolean;
  collapsed: boolean;
  onToggle: () => void;
  dim: boolean;
  hit: boolean;
  href?: string;
  /** In full screen a click selects the card (opens the overlay) instead of navigating. */
  onSelect?: () => void;
  picked: boolean;
  /** Admin drag and drop: whether this card can be dragged, and how it reacts to a card dragged over it. */
  dnd?: {
    draggable: boolean;
    over: "ok" | "no" | null;
    dragging: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
}) {
  const isSelf = node.kind === "self";
  const isCompany = node.kind === "company";
  const ring = dnd?.over === "ok"
    ? "border-emerald-500 ring-2 ring-emerald-400/60 bg-emerald-50"
    : dnd?.over === "no"
      ? "border-rose-300 ring-2 ring-rose-200 cursor-not-allowed"
    : picked
    ? "border-primary ring-2 ring-primary/40"
    : isSelf
      ? "border-primary ring-2 ring-primary/20"
    : hit
      ? "border-gold ring-2 ring-gold/40"
      : "border-line";

  const body = (
    <div className="flex items-center gap-2 text-left">
      {isCompany ? (
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Building2 className="h-3.5 w-3.5" />
        </span>
      ) : (
        <Avatar name={node.name} size="sm" />
      )}
      <div className="min-w-0">
        <p className="max-w-[6.5rem] truncate text-xs font-semibold text-ink" title={node.name}>
          {node.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] leading-tight text-slate-500">
          {isSelf && <span className="font-semibold text-primary">You</span>}
          {node.kind === "upline" && <span className="font-medium text-primary">Level {node.level} above</span>}
          {isCompany && <span>Head organization</span>}
          {node.kind === "member" && node.status === "approved" && <span>Sales rep</span>}
          {node.kind !== "upline" && !isCompany && node.status && node.status !== "approved" && (
            <span className={`rounded-full px-1.5 py-px font-medium capitalize ${PILL[node.status] ?? "bg-slate-100 text-slate-600"}`}>
              {node.status}
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div
      {...(dnd
        ? {
            "data-nodrag": true, // keeps the full-screen pan from grabbing a card
            draggable: dnd.draggable,
            onDragStart: dnd.onDragStart,
            onDragEnd: dnd.onDragEnd,
            onDragOver: dnd.onDragOver,
            onDragLeave: dnd.onDragLeave,
            onDrop: dnd.onDrop,
          }
        : {})}
      className={`relative w-40 rounded-lg border bg-white px-2.5 py-2 shadow-sm transition-opacity ${ring} ${
        dim || dnd?.dragging ? "opacity-40" : ""
      } ${dnd?.draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {onSelect ? (
        <button type="button" draggable={false} onClick={onSelect} className="block w-full cursor-pointer text-left hover:opacity-80">
          {body}
        </button>
      ) : href ? (
        <Link href={href} draggable={false} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
      {node.kind !== "upline" && (node.teamSize > 0 || admin) && !isCompany && (
        <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5 text-[10px] text-slate-500">
          <span>
            <b className="text-ink">{node.teamSize}</b> team
          </span>
          {admin && node.sales !== undefined && <b className="text-ink">{formatMoney(node.sales)}</b>}
        </div>
      )}
      {isCompany && (
        <div className="mt-1.5 border-t border-line pt-1.5 text-[10px] text-slate-500">
          <b className="text-ink">{node.teamSize}</b> affiliates
        </div>
      )}
      {node.children.length > 0 && (
        <button
          type="button"
          data-nodrag
          onClick={onToggle}
          aria-label={collapsed ? "Expand team" : "Collapse team"}
          aria-expanded={!collapsed}
          className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-white px-1 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-primary-light"
        >
          {collapsed ? node.children.length : <Minus className="h-2.5 w-2.5" />}
        </button>
      )}
    </div>
  );
}

/** Full-screen overlay: details for the card that was clicked, in place of navigating away. */
function DetailsPanel({
  node,
  admin,
  href,
  onClose,
}: {
  node: HierarchyNode;
  admin: boolean;
  href?: string;
  onClose: () => void;
}) {
  const role =
    node.kind === "self"
      ? "You"
      : node.kind === "upline"
        ? `Level ${node.level} above you`
        : node.status === "approved"
          ? "Sales rep"
          : (node.status ?? "Sales rep");
  const rows: [string, string][] = [];
  if (admin && node.email) rows.push(["Email", node.email]);
  if (node.status) rows.push(["Status", node.status]);
  if (node.kind !== "upline") {
    rows.push(["Direct recruits", String(node.children.length)]);
    rows.push(["Total team", String(node.teamSize)]);
  }
  if (admin && node.sales !== undefined) rows.push(["Lifetime sales", formatMoney(node.sales)]);

  return (
    <aside
      className="absolute right-4 top-16 z-20 w-72 rounded-xl border border-line bg-white p-4 shadow-xl"
      aria-label="Affiliate details"
    >
      <div className="flex items-start gap-3">
        <Avatar name={node.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink" title={node.name}>
            {node.name}
          </p>
          <p className="text-xs capitalize text-slate-500">{role}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md p-1 text-slate-400 hover:bg-page-bg hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {rows.length > 0 && (
        <dl className="mt-3 divide-y divide-line border-t border-line text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-slate-500">{k}</dt>
              <dd className="min-w-0 truncate font-medium capitalize text-ink" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {href && (
        <Link
          href={href}
          className="mt-3 block rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-white hover:bg-primary-dark"
        >
          Open affiliate
        </Link>
      )}
    </aside>
  );
}

export default function HierarchyTree({
  root,
  admin = false,
  defaultOpenDepth = 99,
  linkBase,
}: {
  root: HierarchyNode;
  /** Admin trees show sales and email search. */
  admin?: boolean;
  /** Levels shown open at first; deeper branches start collapsed. */
  defaultOpenDepth?: number;
  /** When set, each affiliate card links to `${linkBase}/${id}`. A string, so a server page can pass it. */
  linkBase?: string;
}) {
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  const [selected, setSelected] = useState<HierarchyNode | null>(null);
  const { parents, open, matches, depths } = useMemo(() => index(root, query), [root, query]);
  const router = useRouter();

  // Admin drag and drop: drop a card on another to move it (and its team) under that affiliate, or on the
  // company card to make it top level.
  const byId = useMemo(() => {
    const nodes = new Map<string, HierarchyNode>();
    const parentOf = new Map<string, string>();
    (function walk(n: HierarchyNode) {
      nodes.set(n.id, n);
      n.children.forEach((c) => {
        parentOf.set(c.id, n.id);
        walk(c);
      });
    })(root);
    return { nodes, parentOf };
  }, [root]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ node: HierarchyNode; target: HierarchyNode } | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  /** Whether the dragged card may be dropped on this one. Mirrors the server's rules. */
  function canDrop(targetId: string) {
    if (!dragId || dragId === targetId) return false;
    const target = byId.nodes.get(targetId);
    if (!target) return false;
    if (target.kind !== "company" && target.status !== "approved") return false;
    if (byId.parentOf.get(dragId) === targetId) return false; // already there
    for (let c: string | undefined = targetId; c; c = byId.parentOf.get(c)) {
      if (c === dragId) return false; // can't go under their own team
    }
    return true;
  }

  function dropOn(targetId: string) {
    const node = dragId ? byId.nodes.get(dragId) : undefined;
    const target = byId.nodes.get(targetId);
    const ok = canDrop(targetId);
    setDragId(null);
    setOverId(null);
    if (node && target && ok) {
      setMoveError("");
      setPendingMove({ node, target });
    }
  }

  async function confirmMove() {
    if (!pendingMove) return;
    setMoving(true);
    setMoveError("");
    try {
      const res = await fetch("/api/lumera-ops/hierarchy/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingMove.node.id,
          parentId: pendingMove.target.kind === "company" ? null : pendingMove.target.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMoveError(data.error ?? "Could not move this affiliate.");
        return;
      }
      setPendingMove(null);
      router.refresh();
    } catch {
      setMoveError("Network error. Please try again.");
    } finally {
      setMoving(false);
    }
  }

  // Dragging near an edge of the canvas scrolls it, so far-away cards can be reached.
  function autoScroll(e: React.DragEvent) {
    const box = scrollRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const edge = 56;
    if (e.clientX < r.left + edge) box.scrollLeft -= 18;
    else if (e.clientX > r.right - edge) box.scrollLeft += 18;
    if (e.clientY < r.top + edge) box.scrollTop -= 18;
    else if (e.clientY > r.bottom - edge) box.scrollTop += 18;
  }

  // Collapsed set starts from the depth limit; the user's toggles then override it.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const searching = query.trim().length > 0;

  function isCollapsed(id: string) {
    if (!parents.has(id)) return false;
    if (searching && open.has(id)) return false;
    if (id in overrides) return overrides[id];
    return (depths.get(id) ?? 0) >= defaultOpenDepth;
  }

  function setAll(collapse: boolean) {
    setOverrides(Object.fromEntries([...parents].map((id) => [id, collapse && id !== root.id])));
  }

  // The tree's natural (unscaled) size; transforms don't change offsetWidth, so this stays stable.
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setNatural({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Zoom that shows the whole tree: by width normally, by width and height in full screen. */
  function fitZoom(box: HTMLElement) {
    const byWidth = (box.clientWidth - 48) / natural.w;
    const byHeight = isFull && natural.h ? (box.clientHeight - 48) / natural.h : Infinity;
    return clampZoom(Math.min(byWidth, byHeight));
  }

  function fit() {
    const box = scrollRef.current;
    if (!box || !natural.w) return;
    setZoom(fitZoom(box));
    box.scrollLeft = 0;
  }

  // Track the browser's fullscreen state (Esc exits too), and re-fit the tree to the new size.
  useEffect(() => {
    const onChange = () => {
      fitted.current = false;
      const full = document.fullscreenElement === frameRef.current;
      setIsFull(full);
      if (!full) setSelected(null);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  }

  // Full screen only: scroll wheel zooms toward the cursor, and dragging pans the canvas.
  const zoomRef = useRef(zoom);
  const pending = useRef<{ left: number; top: number } | null>(null);
  const dragged = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    zoomRef.current = zoom;
    const box = scrollRef.current;
    if (box && pending.current) {
      box.scrollLeft = pending.current.left;
      box.scrollTop = pending.current.top;
      pending.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !isFull) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const old = zoomRef.current;
      const next = clampZoom(old * Math.exp(-e.deltaY * 0.0015));
      if (next === old) return;
      // Keep the point under the cursor fixed while the canvas scales around it.
      const rect = box.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const pad = 24;
      const r = next / old;
      pending.current = {
        left: (box.scrollLeft + cx - pad) * r + pad - cx,
        top: (box.scrollTop + cy - pad) * r + pad - cy,
      };
      setZoom(next);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [isFull]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const box = scrollRef.current;
    if (!isFull || !box || e.button !== 0 || (e.target as HTMLElement).closest("[data-nodrag]")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = box.scrollLeft;
    const startTop = box.scrollTop;
    dragged.current = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragged.current && Math.hypot(dx, dy) < 5) return;
      dragged.current = true;
      setGrabbing(true);
      box.scrollLeft = startLeft - dx;
      box.scrollTop = startTop - dy;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGrabbing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // A drag that ends over a card must not also count as a click on its link.
  function onClickCapture(e: React.MouseEvent) {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  }

  // Start with the whole tree in view rather than scrolled off to one side.
  useEffect(() => {
    if (fitted.current || !natural.w) return;
    fitted.current = true;
    const box = scrollRef.current;
    if (box) setZoom(Math.min(1, fitZoom(box)));
    // Runs once when the tree is first measured and again on entering/leaving full screen; fitZoom reads that state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural.w, isFull]);

  function renderNode(node: HierarchyNode) {
    const collapsed = isCollapsed(node.id);
    return (
      <li key={node.id}>
        <NodeCard
          node={node}
          admin={admin}
          collapsed={collapsed}
          onToggle={() => setOverrides((o) => ({ ...o, [node.id]: !collapsed }))}
          dim={searching && !matches.has(node.id) && !open.has(node.id)}
          hit={searching && matches.has(node.id)}
          href={linkBase && node.kind !== "company" && !isFull ? `${linkBase}/${node.id}` : undefined}
          onSelect={isFull && node.kind !== "company" ? () => setSelected(node) : undefined}
          picked={isFull && selected?.id === node.id}
          dnd={
            admin
              ? {
                  draggable: node.kind === "member",
                  dragging: dragId === node.id,
                  over: dragId && overId === node.id ? (canDrop(node.id) ? "ok" : "no") : null,
                  onDragStart: (e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", node.id);
                    setDragId(node.id);
                  },
                  onDragEnd: () => {
                    setDragId(null);
                    setOverId(null);
                  },
                  onDragOver: (e) => {
                    if (!dragId) return;
                    e.preventDefault(); // lets the card be a drop target
                    e.dataTransfer.dropEffect = canDrop(node.id) ? "move" : "none";
                    if (overId !== node.id) setOverId(node.id);
                  },
                  onDragLeave: () => setOverId((o) => (o === node.id ? null : o)),
                  onDrop: (e) => {
                    e.preventDefault();
                    dropOn(node.id);
                  },
                }
              : undefined
          }
        />
        {!collapsed && node.children.length > 0 && (
          <ul>
            {node.children.map((c) => renderNode(c))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div ref={frameRef} className={`relative flex flex-col border-line bg-white ${isFull ? "h-screen" : "rounded-xl border"}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {admin && (
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAll(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-page-bg"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
          </button>
          <button
            type="button"
            onClick={() => setAll(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-page-bg"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
          </button>
          <div className="ml-1 flex items-center rounded-lg border border-line">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => setZoom((z) => clampZoom(z / 1.2))}
              className="px-2 py-1.5 text-slate-600 hover:bg-page-bg disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-11 text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => setZoom((z) => clampZoom(z * 1.2))}
              className="px-2 py-1.5 text-slate-600 hover:bg-page-bg disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Fit to screen"
              title="Fit to screen"
              onClick={fit}
              className="border-l border-line px-2 py-1.5 text-slate-600 hover:bg-page-bg"
            >
              <Maximize className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {isFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isFull ? "Exit full screen" : "View in full screen"}
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
        onDragOver={dragId ? autoScroll : undefined}
        className={`min-h-0 flex-1 overflow-auto p-6 ${isFull ? (grabbing ? "cursor-grabbing select-none" : "cursor-grab") : ""}`}
        style={isFull ? undefined : { maxHeight: "70vh" }}
      >
        <div className="mx-auto" style={natural.w ? { width: natural.w * zoom, height: natural.h * zoom } : undefined}>
          <div
            ref={innerRef}
            className="org-tree"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "max-content" }}
          >
            <ul>{renderNode(root)}</ul>
          </div>
        </div>
      </div>
      {admin && (
        <p className="border-t border-line px-3 py-2 text-xs text-slate-500">
          Drag a card onto another affiliate to move them and their team under that person, or onto the LumeraMD card to make
          them top level.
        </p>
      )}
      {pendingMove && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-ink">Move affiliate?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <b className="text-ink">{pendingMove.node.name}</b>
              {pendingMove.node.teamSize > 0 && ` and their team of ${pendingMove.node.teamSize}`} will move from{" "}
              <b className="text-ink">
                {byId.nodes.get(byId.parentOf.get(pendingMove.node.id) ?? "")?.name ?? "the top level"}
              </b>{" "}
              to{" "}
              <b className="text-ink">
                {pendingMove.target.kind === "company" ? "the top level (no sponsor)" : pendingMove.target.name}
              </b>
              .
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
              <li>New orders pay team overrides up the new chain.</li>
              <li>Orders still pending are worked out again on the new chain.</li>
              <li>Approved and paid orders keep the commissions they were paid with.</li>
              <li>Recruit counts change, which can change who qualifies for overrides.</li>
              <li>The affiliate and both sponsors are notified.</li>
            </ul>
            {pendingMove.target.kind !== "company" && pendingMove.target.canRecruit === false && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
                <b>{pendingMove.target.name}</b> has recruiting turned off. They can still have this affiliate on their team and
                earn overrides, but they cannot invite anyone new until recruiting is turned back on.
              </p>
            )}
            {moveError && <p className="mt-3 text-sm text-error">{moveError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={moving}
                onClick={() => setPendingMove(null)}
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-slate-600 hover:bg-page-bg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={moving}
                onClick={confirmMove}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {moving ? "Moving..." : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isFull && selected && (
        <DetailsPanel
          node={selected}
          admin={admin}
          href={linkBase ? `${linkBase}/${selected.id}` : undefined}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
