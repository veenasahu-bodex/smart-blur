
import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [image, setImage] = useState(null);
  const [imageReady, setImageReady] = useState(false);
  const [selected, setSelected] = useState([]);
  const [blurred, setBlurred] = useState([]);
  const [drag, setDrag] = useState(null);
  const [blur, setBlur] = useState(15);
  const [message, setMessage] = useState("");

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  // Load image
  useEffect(() => {
    if (!image) return;

    let active = true;
    const img = new Image();

    img.onload = () => {
      if (!active) return;

      imageRef.current = img;

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }

      setImageReady(true);
    };

    img.onerror = () => {
      if (active) {
        setMessage("Unable to load image. Please try another image.");
      }
    };

    img.src = image;

    return () => {
      active = false;
    };
  }, [image]);

  // Get rectangle coordinates from drag
  const getRectangle = (startX, startY, endX, endY) => {
    return {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY)
    };
  };

  // Draw selection rectangle
  const drawRectangle = (ctx, area, color, fill) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.width, area.height);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = Math.max(2, ctx.canvas.width / 500);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  };

  // Draw original image, blur and selection outlines
  const redraw = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img || !img.naturalWidth) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.filter = "none";
    ctx.drawImage(img, 0, 0, width, height);

    // Blur saved rectangles
    blurred.forEach((area) => {
      if (area.width <= 0 || area.height <= 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(area.x, area.y, area.width, area.height);
      ctx.clip();

      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();
    });

    ctx.filter = "none";

    // Draw selected but not yet blurred rectangles
    selected.forEach((area) => {
      drawRectangle(
        ctx,
        area,
        "#2563eb",
        "rgba(37, 99, 235, 0.10)"
      );
    });

    // Draw rectangle currently being created
    if (drag) {
      const area = getRectangle(
        drag.startX,
        drag.startY,
        drag.x,
        drag.y
      );

      if (area.width > 0 && area.height > 0) {
        drawRectangle(
          ctx,
          area,
          "#7c3aed",
          "rgba(124, 58, 237, 0.12)"
        );
      }
    }
  };

  // Update preview
  useEffect(() => {
    if (imageReady) {
      redraw();
    }
  }, [imageReady, selected, blurred, drag, blur]);

  // Upload image
  const uploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image.");
      event.target.value = "";
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setMessage("Image size should be less than 15 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageReady(false);
        imageRef.current = null;
        setImage(reader.result);
        setSelected([]);
        setBlurred([]);
        setDrag(null);
        dragRef.current = null;
        setMessage("Image uploaded. Drag on the image to select an area.");
      } else {
        setMessage("Could not read the image.");
      }
    };

    reader.onerror = () => {
      setMessage("Failed to read image.");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  // Convert pointer coordinates to original image coordinates
  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return null;

    return {
      x: Math.max(
        0,
        Math.min(
          canvas.width,
          (event.clientX - rect.left) * canvas.width / rect.width
        )
      ),
      y: Math.max(
        0,
        Math.min(
          canvas.height,
          (event.clientY - rect.top) * canvas.height / rect.height
        )
      )
    };
  };

  // Start selection
  const handlePointerDown = (event) => {
    if (!imageReady || !imageRef.current) return;

    event.preventDefault();

    const point = getPoint(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    const newDrag = {
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y
    };

    dragRef.current = newDrag;
    setDrag(newDrag);
    setMessage("Drag to create a rectangular selection.");
  };

  // Update selection while dragging
  const handlePointerMove = (event) => {
    if (!dragRef.current) return;

    const point = getPoint(event);
    if (!point) return;

    const updated = {
      ...dragRef.current,
      x: point.x,
      y: point.y
    };

    dragRef.current = updated;
    setDrag(updated);
  };

  // Complete selection
  const handlePointerUp = (event) => {
    if (!dragRef.current) return;

    const point = getPoint(event);
    if (!point) {
      dragRef.current = null;
      setDrag(null);
      return;
    }

    const current = dragRef.current;

    const area = getRectangle(
      current.startX,
      current.startY,
      point.x,
      point.y
    );

    if (area.width >= 5 && area.height >= 5) {
      setSelected((prev) => [...prev, area]);
      setMessage("Area selected. You can select more sections.");
    } else {
      setMessage("Please drag to select a larger area.");
    }

    dragRef.current = null;
    setDrag(null);
  };

  // Cancel incomplete selection
  const handlePointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  // Apply blur to selected rectangles
  const applyBlur = () => {
    if (selected.length === 0) {
      setMessage("Please select an area first.");
      return;
    }

    setBlurred((prev) => [...prev, ...selected]);
    setSelected([]);
    setMessage("Blur applied to selected areas.");
  };

  // Undo the latest pending selection or blur
  const undoSelection = () => {
    if (selected.length > 0) {
      setSelected((prev) => prev.slice(0, -1));
      setMessage("Last selection removed.");
    } else if (blurred.length > 0) {
      setBlurred((prev) => prev.slice(0, -1));
      setMessage("Last blurred area removed.");
    } else {
      setMessage("Nothing to undo.");
    }
  };

  // Clear all selections and blur
  const clearSelections = () => {
    setSelected([]);
    setBlurred([]);
    setDrag(null);
    dragRef.current = null;
    setMessage("All selections cleared.");
  };

  // Download clean final image
  const downloadImage = () => {
    const img = imageRef.current;

    if (!img || blurred.length === 0) {
      setMessage("Select and blur an area before downloading.");
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      setMessage("Unable to export image.");
      return;
    }

    ctx.drawImage(img, 0, 0);

    blurred.forEach((area) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.x, area.y, area.width, area.height);
      ctx.clip();

      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    });

    ctx.filter = "none";

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        setMessage("Image download failed.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "smartblur-edited.png";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Image downloaded successfully.");
    }, "image/png");
  };

  // Remove uploaded image
  const reset = () => {
    setImage(null);
    setImageReady(false);
    setSelected([]);
    setBlurred([]);
    setDrag(null);
    dragRef.current = null;
    imageRef.current = null;
    setMessage("");
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">◈ SmartBlur</div>
        <span className="header-tag">
          Manual Image Blur Tool
        </span>
      </header>

      <main className="main">
        <div className="intro">
          <span className="eyebrow">IMAGE PRIVACY EDITOR</span>
          <h1>Select & Blur Any Area</h1>
          <p>
            Select any part of your picture with a rectangle
            and blur only that section.
          </p>
        </div>

        <section className="editor">
          <div className="controls">
            <label className="section-label">
              Upload your image
            </label>

            <label className="upload-box">
              <span className="upload-icon">＋</span>
              <strong>Choose an image</strong>
              <span>PNG, JPG or WEBP · Max 15 MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadImage}
              />
            </label>

            {image && (
              <>
                <label className="section-label">
                  1. Select the section
                </label>

                <div className="instruction">
                  <strong>▢ Rectangle Selection</strong>
                  <p>
                    Mouse ya touch se image par drag karke
                    rectangular area select karein.
                  </p>
                </div>

                <label className="section-label">
                  Blur intensity: {blur}px
                </label>

                <input
                  className="blur-slider"
                  type="range"
                  min="2"
                  max="35"
                  value={blur}
                  onChange={(event) =>
                    setBlur(Number(event.target.value))
                  }
                />

                <div className="selection-count">
                  Selected: {selected.length} area(s)
                  <br />
                  Blurred: {blurred.length} area(s)
                </div>

                <button
                  className="detect-btn"
                  type="button"
                  onClick={applyBlur}
                  disabled={selected.length === 0}
                >
                  Blur Selected
                </button>

                <div className="action-row">
                  <button
                    className="reset-btn"
                    type="button"
                    onClick={undoSelection}
                    disabled={
                      selected.length === 0 &&
                      blurred.length === 0
                    }
                  >
                    Undo
                  </button>

                  <button
                    className="reset-btn"
                    type="button"
                    onClick={clearSelections}
                    disabled={
                      selected.length === 0 &&
                      blurred.length === 0
                    }
                  >
                    Clear All
                  </button>
                </div>

                <button
                  className="download-btn"
                  type="button"
                  onClick={downloadImage}
                  disabled={blurred.length === 0}
                >
                  ↓ Download Image
                </button>

                <button
                  className="reset-btn"
                  type="button"
                  onClick={reset}
                >
                  Remove image
                </button>
              </>
            )}

            {message && (
              <p className="message" role="status">
                {message}
              </p>
            )}
          </div>

          <div className="preview">
            <div className="preview-heading">
              <strong>Image Preview</strong>
              <span className="preview-status">
                {blurred.length > 0
                  ? "Blur applied"
                  : "Select an area"}
              </span>
            </div>

            {image ? (
              <div className="canvas-wrap">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    cursor: imageReady ? "crosshair" : "wait",
                    touchAction: "none"
                  }}
                />
              </div>
            ) : (
              <div className="empty-preview">
                <div className="empty-icon">▢</div>
                <strong>Your image will appear here</strong>
                <span>Upload an image to get started</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;