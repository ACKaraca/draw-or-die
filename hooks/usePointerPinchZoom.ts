import { useCallback, useRef, useState, type MouseEvent, type TouchEvent, type WheelEvent } from 'react';

type PanState = {
  x: number;
  y: number;
};

type UsePointerPinchZoomOptions = {
  minZoom?: number;
  maxZoom?: number;
  wheelStep?: number;
};

export function usePointerPinchZoom(options: UsePointerPinchZoomOptions = {}) {
  const minZoom = options.minZoom ?? 0.5;
  const maxZoom = options.maxZoom ?? 5;
  const wheelStep = options.wheelStep ?? 0.15;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });
  const lastTouchDistance = useRef<number | null>(null);

  const clampZoom = useCallback((value: number) => {
    if (value < minZoom) return minZoom;
    if (value > maxZoom) return maxZoom;
    return value;
  }, [maxZoom, minZoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    setHasInteracted(true);
    const delta = event.deltaY > 0 ? -wheelStep : wheelStep;
    setZoom((prev) => clampZoom(prev + delta));
  }, [clampZoom, wheelStep]);

  const handleMouseDown = useCallback((event: MouseEvent<HTMLElement>) => {
    if (zoom <= 1 || event.button !== 0) return;

    setHasInteracted(true);
    setIsDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.preventDefault();
  }, [pan.x, pan.y, zoom]);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!isDragging) return;

    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    setPan({
      x: dragStart.current.panX + dx,
      y: dragStart.current.panY + dy,
    });
  }, [isDragging]);

  const endMouseDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (event.touches.length === 2) {
      setHasInteracted(true);
      setIsPinching(true);
      setIsDragging(false);

      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
      return;
    }

    if (event.touches.length === 1 && zoom > 1) {
      setHasInteracted(true);
      setIsDragging(true);
      dragStart.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  }, [pan.x, pan.y, zoom]);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (event.touches.length === 2 && lastTouchDistance.current !== null) {
      event.preventDefault();

      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const factor = currentDistance / lastTouchDistance.current;

      setZoom((prev) => clampZoom(prev * factor));
      lastTouchDistance.current = currentDistance;
      return;
    }

    if (event.touches.length === 1 && isDragging && zoom > 1) {
      event.preventDefault();
      const dx = event.touches[0].clientX - dragStart.current.x;
      const dy = event.touches[0].clientY - dragStart.current.y;
      setPan({
        x: dragStart.current.panX + dx,
        y: dragStart.current.panY + dy,
      });
    }
  }, [clampZoom, isDragging, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsPinching(false);
    lastTouchDistance.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    setHasInteracted(true);
    setZoom((prev) => clampZoom(prev + 0.25));
  }, [clampZoom]);

  const zoomOut = useCallback(() => {
    setHasInteracted(true);
    setZoom((prev) => clampZoom(prev - 0.25));
  }, [clampZoom]);

  const surfaceTouchAction = zoom > 1 || isDragging || isPinching ? 'none' : 'pan-y';

  return {
    zoom,
    pan,
    isDragging,
    hasInteracted,
    surfaceTouchAction,
    resetView,
    zoomIn,
    zoomOut,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp: endMouseDrag,
    handleMouseLeave: endMouseDrag,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
