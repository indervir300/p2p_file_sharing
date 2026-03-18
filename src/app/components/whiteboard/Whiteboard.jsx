'use client';
import {
  useRef, useEffect, useCallback,
  useState, forwardRef, useImperativeHandle,
} from 'react';

const COLORS = [
  '#0f172a', '#ffffff', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#3b82f6', '#a855f7',
];

const WIDTHS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 5 },
  { label: 'L', value: 14 },
];

// forwardRef so page.jsx can call handlePeerEvent on it
const Whiteboard = forwardRef(function Whiteboard({ onSendEvent, onClose }, ref) {
  const canvasRef  = useRef(null);
  const ctxRef     = useRef(null);
  const isDrawing  = useRef(false);
  const strokeId   = useRef(null);
  const strokesRef = useRef([]); // all strokes — used for undo + redraw
  const lastPt     = useRef(null);

  const [color,    setColor]    = useState('#0f172a');
  const [penWidth, setPenWidth] = useState(3);
  const [tool,     setTool]     = useState('pen'); // 'pen' | 'eraser'

  // ── Canvas init + resize observer ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    ctxRef.current = ctx;

    const getBgColor = () => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff';
    
    const fit = () => {
      const tmp = document.createElement('canvas');
      tmp.width  = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.fillStyle = getBgColor();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tmp, 0, 0);
    };

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = getBgColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // ── Draw one segment ───────────────────────────────────────────────
  const drawSeg = useCallback((ctx, from, to, c, w, t) => {
    ctx.beginPath();
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff';
    ctx.strokeStyle = t === 'eraser' ? bg : c;
    ctx.lineWidth   = t === 'eraser' ? w * 4 : w;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x,   to.y);
    ctx.stroke();
  }, []);

  // ── Redraw every stroke from scratch ──────────────────────────────
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((s) => {
      for (let i = 1; i < s.points.length; i++) {
        drawSeg(ctx, s.points[i - 1], s.points[i], s.color, s.width, s.tool);
      }
    });
  }, [drawSeg]);

  // ── Normalize coords 0-1 so both peers draw correctly
  //    regardless of different screen / canvas sizes ─────────────────
  const norm = (pt) => {
    const c = canvasRef.current;
    return { x: pt.x / c.width, y: pt.y / c.height };
  };
  const denorm = (pt) => {
    const c = canvasRef.current;
    return { x: pt.x * c.width, y: pt.y * c.height };
  };

  // ── Get canvas-relative pointer position ──────────────────────────
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src  = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  // ── Pointer down ──────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = true;
    const pt = getPos(e);
    lastPt.current   = pt;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    strokeId.current = id;
    strokesRef.current.push({ id, color, width: penWidth, tool, points: [pt], fromPeer: false });

    const n = norm(pt);
    onSendEvent?.({ kind: 'wb-begin', id, color, width: penWidth, tool, x: n.x, y: n.y });
  }, [color, penWidth, tool, onSendEvent]);

  // ── Pointer move ──────────────────────────────────────────────────
  const onPointerMove = useCallback((e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pt  = getPos(e);
    const ctx = ctxRef.current;

    drawSeg(ctx, lastPt.current, pt, color, penWidth, tool);

    const stroke = strokesRef.current.find((s) => s.id === strokeId.current);
    if (stroke) stroke.points.push(pt);

    const n = norm(pt);
    onSendEvent?.({ kind: 'wb-point', id: strokeId.current, x: n.x, y: n.y });

    lastPt.current = pt;
  }, [color, penWidth, tool, onSendEvent, drawSeg]);

  // ── Pointer up ────────────────────────────────────────────────────
  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    onSendEvent?.({ kind: 'wb-end', id: strokeId.current });
    strokeId.current = null;
    lastPt.current   = null;
  }, [onSendEvent]);

  // ── Undo ──────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const arr = strokesRef.current;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!arr[i].fromPeer) {
        const id = arr[i].id;
        arr.splice(i, 1);
        redrawAll();
        onSendEvent?.({ kind: 'wb-undo', id });
        return;
      }
    }
  }, [redrawAll, onSendEvent]);

  // ── Clear canvas ──────────────────────────────────────────────────
  const clear = useCallback(() => {
    strokesRef.current = [];
    redrawAll();
    onSendEvent?.({ kind: 'wb-clear' });
  }, [redrawAll, onSendEvent]);

  // ── Handle incoming peer events ───────────────────────────────────
  const handlePeerEvent = useCallback((event) => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    if (!canvas || !ctx) return;

    if (event.kind === 'wb-clear') {
      strokesRef.current = [];
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (event.kind === 'wb-begin') {
      const pt = denorm({ x: event.x, y: event.y });
      strokesRef.current.push({
        id: event.id, color: event.color,
        width: event.width, tool: event.tool,
        points: [pt], fromPeer: true,
      });
      return;
    }

    if (event.kind === 'wb-point') {
      const stroke = strokesRef.current.find((s) => s.id === event.id);
      if (!stroke) return;
      const from = stroke.points[stroke.points.length - 1];
      const to   = denorm({ x: event.x, y: event.y });
      stroke.points.push(to);
      drawSeg(ctx, from, to, stroke.color, stroke.width, stroke.tool);
      return;
    }

    if (event.kind === 'wb-undo') {
      const idx = strokesRef.current.findIndex((s) => s.id === event.id);
      if (idx !== -1) {
        strokesRef.current.splice(idx, 1);
        redrawAll();
      }
    }
  }, [drawSeg, redrawAll]);

  // Expose handlePeerEvent to parent via ref
  useImperativeHandle(ref, () => ({ handlePeerEvent }), [handlePeerEvent]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary">

      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-secondary bg-bg-primary overflow-x-auto">

        {/* Back */}
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-border-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary transition-colors"
        >
          ← Back
        </button>

        <div className="w-px h-5 shrink-0 bg-border-secondary" />

        {/* Pen / Eraser */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setTool('pen')}
            title="Pen"
            className={`rounded-lg p-1.5 text-base transition-colors ${
              tool === 'pen' ? 'bg-brand-primary text-white' : 'hover:bg-bg-secondary text-text-secondary'
            }`}
          >
            ✏️
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="Eraser"
            className={`rounded-lg p-1.5 text-base transition-colors ${
              tool === 'eraser' ? 'bg-brand-primary text-white' : 'hover:bg-bg-secondary text-text-secondary'
            }`}
          >
            🧹
          </button>
        </div>

        <div className="w-px h-5 shrink-0 bg-border-secondary" />

        {/* Color swatches */}
        <div className="flex items-center gap-1 shrink-0">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              style={{
                background: c,
                outline: c === '#ffffff' ? '1px solid #e2e8f0' : 'none',
              }}
              className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c && tool === 'pen'
                  ? 'border-brand-primary scale-110'
                  : 'border-transparent'
              }`}
            />
          ))}
        </div>

        <div className="w-px h-5 shrink-0 bg-border-secondary" />

        {/* Width */}
        <div className="flex items-center gap-1 shrink-0">
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              onClick={() => setPenWidth(w.value)}
              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                penWidth === w.value
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:bg-bg-secondary'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 shrink-0 bg-border-secondary" />

        {/* Undo / Clear */}
        <button
          onClick={undo}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          Undo
        </button>
        <button
          onClick={clear}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brand-danger hover:bg-brand-danger/10 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* ── Canvas ── */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full touch-none cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
});

export default Whiteboard;
