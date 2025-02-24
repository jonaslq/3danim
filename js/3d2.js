// Utility functions
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

/**
 * getRandomFloat returns a random float between min (inclusive) and max (exclusive).
 *
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @return {number} A random float value.
 */
const getRandomFloat = (min, max) => (Math.random() * (max - min)) + min;

const sortBy = (field, reverse, primer) => {
    const key = primer ? (x => primer(x[field])) : (x => x[field]);
    reverse = [-1, 1][+!!reverse];
    return (a, b) => reverse * ((key(a) > key(b)) - (key(b) > key(a)));
};

// Get the canvas element and its 2D context
const canvas = document.getElementById('canvas'),
    context = canvas.getContext('2d');

// Initialize canvas dimensions and perspective variables
let canvasWidth = canvas.width = window.innerWidth,
    canvasHeight = canvas.height = window.innerHeight,
    halfCanvasWidth = canvasWidth / 2,
    halfCanvasHeight = canvasHeight / 2,
    fov = 600;

const PI2 = Math.PI * 2;
let angleX = 0, angleY = 0, angleZ = 0;
const points3D = [];
const SPRITE_COUNT = 62;


const spriteImg = new Image();
spriteImg.src = 'Amigaball.png';

// Variables for sprite animation and rotation
let spriteAnimX = 0, spriteAnimY = 0, spriteAnimZ = 0;
let animationDelta = 0;
const spriteDeltaX = getRandomFloat(0.05, 0.4);
const spriteDeltaY = getRandomFloat(0.05, 0.4);
const spriteDeltaZ = getRandomFloat(0.05, 0.4);

const STARFIELD_HALF_SIZE = 250;
const NUMBER_OF_STARS = 1850;
const STARFIELD_RATIO = 3;

// Create an array of pixels (starfield points) that is 4 times larger than before.
// We multiply the STARFIELD_HALF_SIZE by 4 only for starfield point generation.
const pixels = [];
for (let i = 0; i < NUMBER_OF_STARS; i++) {
    // Generate starfield coordinates 4 times larger than before
    const sx = getRandomInt(-STARFIELD_HALF_SIZE * STARFIELD_RATIO, STARFIELD_HALF_SIZE * STARFIELD_RATIO);
    const sy = getRandomInt(-STARFIELD_HALF_SIZE * STARFIELD_RATIO, STARFIELD_HALF_SIZE * STARFIELD_RATIO);
    const sz = getRandomInt(-STARFIELD_HALF_SIZE * STARFIELD_RATIO, STARFIELD_HALF_SIZE * STARFIELD_RATIO);
    pixels.push({ sx, sy, sz });
}

// Adjust canvas dimensions on window resize
window.onresize = () => {
    canvasWidth = canvas.width = window.innerWidth;
    canvasHeight = canvas.height = window.innerHeight;
    halfCanvasWidth = canvasWidth / 2;
    halfCanvasHeight = canvasHeight / 2;
};

// Define a set of points (links) forming a shape
const linkPoints = [
    { sx: -150, sy: -150, sz: 250 }, { sx: -150, sy: 150, sz: 250 }, // L
    { sx: -150, sy: 150, sz: 250 }, { sx: -100, sy: 150, sz: 250 }, // L
    { sx: -50, sy: 0, sz: 250 }, { sx: -50, sy: 150, sz: 250 },    // I
    { sx: 0, sy: 0, sz: 250 }, { sx: 0, sy: 150, sz: 250 },     // N
    { sx: 0, sy: 0, sz: 250 }, { sx: 100, sy: 150, sz: 250 },   // N
    { sx: 100, sy: 0, sz: 250 }, { sx: 100, sy: 150, sz: 250 },   // N
    { sx: 150, sy: -150, sz: 250 }, { sx: 150, sy: 150, sz: 250 },   // K
    { sx: 150, sy: 75, sz: 250 }, { sx: 200, sy: 0, sz: 250 },     // K
    { sx: 150, sy: 75, sz: 250 }, { sx: 200, sy: 150, sz: 250 }    // K
];

const LINK_TEXT_OFFSET = 500;

// Define threshold constants for angle rendering
const ANGLE_RENDER_THRESHOLD_MIN = 1.14;
const ANGLE_RENDER_THRESHOLD_MAX = 5.14;

// Processes a link point: rotates, scales, and calculates display color
const processLink = (linkPoint, angleX, angleY, angleZ, fov, mathObj) => {
    let screenX = linkPoint.sx;
    let screenY = linkPoint.sy;
    let depth = linkPoint.sz - LINK_TEXT_OFFSET; // place the link text in front of the starfield 
    const { x: rotatedX, y: rotatedY, z: rotatedZ } = rotate(screenX, screenY, depth, angleX, angleY, angleZ);
    screenX = rotatedX;
    screenY = rotatedY;
    depth = rotatedZ;
    const scale = fov / (fov + depth);
    screenX *= scale;
    screenY *= scale;
    let colorValue = mathObj.floor((scale / 2) * 256);
    colorValue = colorValue < 0 ? 0 : (colorValue > 255 ? 255 : colorValue);
    return { screenX, screenY, depth, color: colorValue, scale };
};

// Starts the animation loop
const animate = () => {
    window.requestAnimationFrame(animate);
    main();
};

/**
 * getBoxCenter returns the rotated and scaled virtual center of the box.
 * The virtual center is defined as (0, 0, STARFIELD_HALF_SIZE - LINK_TEXT_OFFSET).
 *
 * @param {number} angleX - Rotation angle around the X axis.
 * @param {number} angleY - Rotation angle around the Y axis.
 * @param {number} angleZ - Rotation angle around the Z axis.
 * @return {object} An object containing the rotated center position and its scale factor.
 */
function getBoxCenter(angleX, angleY, angleZ) {
    // Define the virtual center of the box.
    // For example, using STARFIELD_HALF_SIZE = 250 and LINK_TEXT_OFFSET = 500,
    // the virtual center becomes (0, 0, 250 - 500) = (0, 0, -250).
    const centerX = 0;
    const centerY = 0;
    const centerZ = STARFIELD_HALF_SIZE - LINK_TEXT_OFFSET;

    // Rotate the virtual center using the existing rotate() function.
    const rotatedCenter = rotate(centerX, centerY, centerZ, angleX, angleY, angleZ);

    // Compute the scale factor for the rotated center.
    // This scale factor tells you how large the center appears.
    const centerScale = fov / (fov + rotatedCenter.z);

    return { rotatedCenter, centerScale };
}

/**
 * main updates rotation variables, renders 3D points (balls), and link vectors.
 * It now uses dynamic angle speeds and supports pausing.
 */
let currentCenterScale = 0;

const main = () => {
    if (!paused) {
        clear();

        // Update rotation angles using user-defined speed factors
        angleX += angleSpeedX;
        angleY += angleSpeedY;
        angleZ += angleSpeedZ;
        if (angleX > PI2) { angleX -= PI2; }
        if (angleY > PI2) { angleY -= PI2; }
        if (angleZ > PI2) { angleZ -= PI2; }

        // Generate points for balls from starfield and sprites
        rotateStars(pixels, angleX, angleY, angleZ);
        animationDelta -= 0.005;
        rotateBalls(spriteAnimX, spriteAnimY, spriteAnimZ, animationDelta, angleX, angleY, angleZ);

        // Calculate the virtual center of the box and its scale factor
        const { rotatedCenter, centerScale } = getBoxCenter(angleX, angleY, angleZ);
        currentCenterScale = centerScale;
        // Debug (optional): console.log("Center scale:", centerScale);

        // Determine the rendering order based on the center's scale factor.
        if (centerScale < CENTER_RENDER_THRESHOLD) {
            // Render balls first, then draw link segments on top.
            renderLinkSegments(linkPoints, angleX, angleY, angleZ, fov, context, halfCanvasWidth, halfCanvasHeight, Math);
            render();
        } else {
            // Otherwise, render link segments first, then balls.
            render();
            renderLinkSegments(linkPoints, angleX, angleY, angleZ, fov, context, halfCanvasWidth, halfCanvasHeight, Math);
        }
        points3D.length = 0;

        // Render the overlay containing rotation angles and tinted sprite cache info.
        renderAngles();
    }
};

// Clears the canvas
const clear = () => context.clearRect(0, 0, canvasWidth, canvasHeight);

// Rotates the sprite (balls) and adds their rotated 3D points to points3D
const rotateBalls = (spriteAnimX, spriteAnimY, spriteAnimZ, animationDelta, angleX, angleY, angleZ) => {
    const type = 4;  // Type 4 indicates sprites
    const spriteNum = SPRITE_COUNT;
    spriteAnimX += animationDelta;
    spriteAnimY += animationDelta;
    spriteAnimZ += animationDelta;
    for (let i = 0; i <= spriteNum; i++) {
        let x = Math.sin(spriteAnimX) * 200;
        let y = Math.sin(spriteAnimY) * 200;
        let z = Math.sin(spriteAnimZ) * 200;
        spriteAnimX -= spriteDeltaX;
        spriteAnimY -= spriteDeltaY;
        spriteAnimZ -= spriteDeltaZ;
        const rotated = rotate(x, y, z, angleX, angleY, angleZ);
        create3DPoint(rotated.x, rotated.y, rotated.z, type);
    }
};

// Rotates a 3D point (x, y, z) by angles angleX, angleY, and angleZ
const rotate = (x, y, z, angleX, angleY, angleZ) => {
    let tempX = x * Math.cos(angleX) - y * Math.sin(angleX);
    let tempY = x * Math.sin(angleX) + y * Math.cos(angleX);
    x = tempX;
    y = tempY;

    tempY = y * Math.cos(angleY) - z * Math.sin(angleY);
    let tempZ = y * Math.sin(angleY) + z * Math.cos(angleY);
    y = tempY;
    z = tempZ;

    tempZ = z * Math.cos(angleZ) - x * Math.sin(angleZ);
    tempX = z * Math.sin(angleZ) + x * Math.cos(angleZ);
    x = tempX;
    z = tempZ;

    return { x, y, z };
};

// Rotates an array of 'star' points and adds the rotated 3D points to points3D
const rotateStars = (pixels, angleX, angleY, angleZ) => {
    const type = 3;  // Type 3 indicates basic pixels/points
    for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        let { x, y, z } = rotate(pixel.sx, pixel.sy, pixel.sz, angleX, angleY, angleZ);
        create3DPoint(x, y, z, type);
    }
};

// Define constants for star brightness interpolation
const MIN_STAR_BRIGHTNESS = 20;  // Minimum brightness value for stars
const MAX_STAR_BRIGHTNESS = 255; // Maximum brightness value for stars

// Define the scale range for interpolation (adjust as needed)
const STAR_SCALE_MIN = 0.2;
const STAR_SCALE_MAX = 0.8;

/**
 * lerp returns linearly interpolated value between a and b using factor t.
 *
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Interpolation factor between 0 and 1.
 * @return {number} Interpolated value.
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * mapRange linearly maps a value from one range to another.
 *
 * @param {number} value - The input value.
 * @param {number} inMin - The minimum of the input range.
 * @param {number} inMax - The maximum of the input range.
 * @param {number} outMin - The minimum of the output range.
 * @param {number} outMax - The maximum of the output range.
 * @return {number} The mapped value.
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
    // Clamp the value into the input range
    const clampedValue = Math.max(inMin, Math.min(value, inMax));
    const t = (clampedValue - inMin) / (inMax - inMin);
    return lerp(outMin, outMax, t);
}

// Renders the 3D scene, drawing each point/sprite from points3D
const render = () => {
    let tray = points3D.sort(sortBy('sz', true, parseInt)); // Sort by depth
    let i = tray.length;
    while (i--) {
        const px = tray[i];
        let x2d = px.sx;
        let y2d = px.sy;
        let z2d = px.sz;
        const scale = fov / (fov + z2d);
        x2d *= scale;
        y2d *= scale;
        let color = Math.floor((scale / 2) * 256);
        if (color < 0) color = 0;
        if (color > 255) color = 255;
        switch (px.tt) {
            case 3:
                // Instead of directly clamping, interpolate brightness based on the scale.
                // The scale is mapped from STAR_SCALE_MIN to STAR_SCALE_MAX into MIN_STAR_BRIGHTNESS to MAX_STAR_BRIGHTNESS.
                const starBrightnessValue = Math.floor(mapRange(scale, STAR_SCALE_MIN, STAR_SCALE_MAX, MIN_STAR_BRIGHTNESS, MAX_STAR_BRIGHTNESS));
                context.fillStyle = `rgba(${starBrightnessValue},${starBrightnessValue},${starBrightnessValue},1)`;
                context.fillRect(
                    x2d + halfCanvasWidth,
                    y2d + halfCanvasHeight,
                    1 * scale,
                    1 * scale
                );
                break;
            case 4:
                // Calculate brightness factor based on scale with a minimum value of 0.2
                let baseBrightness = Math.max(0.2, scale);
                // Multiply by darkenFactor to further reduce brightness (e.g., 0.5 for 50% brightness)
                const darkenFactor = 0.5; // Adjust this value as needed to get darker sprites
                let brightnessValue = baseBrightness * darkenFactor;
                // Get the tinted sprite from cache using the adjusted brightness
                const tintedSprite = getCachedTintedSprite(brightnessValue);
                // Draw the tinted sprite onto the main canvas
                context.drawImage(
                    tintedSprite,
                    0,
                    0,
                    tintedSprite.width,
                    tintedSprite.height,
                    x2d + halfCanvasWidth,
                    y2d + halfCanvasHeight,
                    (spriteImg.width / 10) * scale,
                    (spriteImg.height / 10) * scale
                );
                break;
            default:
                break;
        }
    }
};

/**
 * getTintedSpriteImage returns an offscreen canvas with the sprite image tinted
 * by the specified brightness factor.
 *
 * @param {number} brightness - The brightness factor (e.g., 0.2 to 1).
 * @return {HTMLCanvasElement} An offscreen canvas with the tinted sprite.
 */
function getTintedSpriteImage(brightness) {
    // Create an offscreen canvas element
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = spriteImg.width;
    offscreenCanvas.height = spriteImg.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    // Draw the original sprite image onto offscreen canvas
    offscreenCtx.drawImage(spriteImg, 0, 0);

    // Get the image data from the offscreen canvas
    const imageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const data = imageData.data; // Uint8ClampedArray

    // Adjust the brightness for each pixel without changing the alpha channel
    for (let i = 0; i < data.length; i += 4) {
        // Multiply the R, G, B channels by the brightness factor
        data[i] = Math.min(255, data[i] * brightness);     // Red channel
        data[i + 1] = Math.min(255, data[i + 1] * brightness); // Green channel
        data[i + 2] = Math.min(255, data[i + 2] * brightness); // Blue channel
        // data[i + 3] is the alpha channel, which we leave unchanged
    }
    // Put the modified image data back to the offscreen canvas
    offscreenCtx.putImageData(imageData, 0, 0);

    return offscreenCanvas;
}

/**
 * Cached tinted sprite images keyed by brightness factor to avoid recalculation.
 * The keys in the cache are rounded brightness values.
 */
const tintedSpriteCache = {};

/**
 * getCachedTintedSprite returns a cached tinted sprite image if available,
 * or generates one if not.
 *
 * @param {number} brightness - The brightness factor.
 * @return {HTMLCanvasElement} The tinted sprite image from cache.
 */
function getCachedTintedSprite(brightness) {
    // Round brightness factor to 2 decimals for caching
    const key = brightness.toFixed(2);
    if (!tintedSpriteCache[key]) {
        tintedSpriteCache[key] = getTintedSpriteImage(brightness);
    }
    return tintedSpriteCache[key];
}

// Unified function to add a new point to the 3D array (points3D)
const create3DPoint = (x, y, z, t) => points3D.push({ sx: x, sy: y, sz: z, tt: t });

// Renders line segments sorted by average depth.
// Each segment is created by processing two linkPoints (assumed to form a line).
const renderLinkSegments = (linkPoints, angleX, angleY, angleZ, fov, context, halfCanvasWidth, halfCanvasHeight, Math) => {
    const segments = [];
    // Loopa i steg om 2 (bakifrån)
    for (let i = linkPoints.length - 1; i >= 1; i -= 2) {
        const p1 = processLink(linkPoints[i], angleX, angleY, angleZ, fov, Math);
        const p2 = processLink(linkPoints[i - 1], angleX, angleY, angleZ, fov, Math);
        // Räkna ut medeldjup för segmentet
        const avgDepth = (p1.depth + p2.depth) / 2;
        segments.push({ p1, p2, avgDepth });
    }
    // Sortera segmenten: de med lägre avgDepth (färre värden, alltså längre bort om högre betyder närmare) ritas först.
    segments.sort((a, b) => a.avgDepth - b.avgDepth);

    // Rita varje segment med en gradient
    segments.forEach(segment => {
        const { p1, p2 } = segment;
        const grad = context.createLinearGradient(
            p1.screenX + halfCanvasWidth,
            p1.screenY + halfCanvasHeight,
            p2.screenX + halfCanvasWidth,
            p2.screenY + halfCanvasHeight
        );
        grad.addColorStop(0, `rgba(${p1.color},${p1.color},${p1.color},1)`);
        grad.addColorStop(1, `rgba(${p2.color},${p2.color},${p2.color},1)`);
        context.strokeStyle = grad;
        // Här kan du anpassa linjetjockleken, t.ex. genom att använda ett medelvärde av p1.scale och p2.scale.
        context.lineWidth = 2 * ((p1.scale + p2.scale) / 2);
        context.beginPath();
        context.moveTo(p1.screenX + halfCanvasWidth, p1.screenY + halfCanvasHeight);
        context.lineTo(p2.screenX + halfCanvasWidth, p2.screenY + halfCanvasHeight);
        context.stroke();
    });
};

/**
 * getOffscreenMemoryUsage calculates the memory usage of a canvas in bytes (assumes 4 bytes per pixel for RGBA),
 * and returns a formatted string in KB or MB.
 *
 * @param {number} width - The width of the canvas in pixels.
 * @param {number} height - The height of the canvas in pixels.
 * @return {string} Memory usage formatted as 'xxx KB' or 'xxx MB'.
 */
function getOffscreenMemoryUsage(width, height) {
    // Calculate total bytes used (RGBA = 4 bytes per pixel)
    const totalBytes = width * height * 4;
    const totalKB = totalBytes / 1024;
    const totalMB = totalKB / 1024;

    // Display in MB if more than 1 MB, else in KB
    if (totalMB >= 1) {
        return `${totalMB.toFixed(2)} MB`;
    } else {
        return `${totalKB.toFixed(2)} KB`;
    }
}

/**
 * getCacheMemoryUsage calculates the total memory usage of all tinted sprite canvases in the cache.
 *
 * @return {string} Memory usage formatted as 'xxx KB' or 'xxx MB'.
 */
function getCacheMemoryUsage() {
    let totalBytes = 0;
    // Iterate over all cached tinted sprite canvases 
    Object.values(tintedSpriteCache).forEach(canvas => {
        totalBytes += canvas.width * canvas.height * 4; // 4 bytes per pixel (RGBA)
    });

    const totalKB = totalBytes / 1024;
    const totalMB = totalKB / 1024;

    if (totalMB >= 1) {
        return `${totalMB.toFixed(2)} MB`;
    } else {
        return `${totalKB.toFixed(2)} KB`;
    }
}

/**
 * renderAngles renders rotation angles and cache statistics in the top corners of the canvas.
 */
const renderAngles = () => {
    context.font = "16px sans-serif";
    context.fillStyle = "white";

    // Print rotation angles in the top-left corner with an offset
    context.fillText(`X: ${angleX.toFixed(2)}`, 20, 20);
    context.fillText(`Y: ${angleY.toFixed(2)}`, 20, 40);
    context.fillText(`Z: ${angleZ.toFixed(2)}`, 20, 60);
    context.fillText(`CenterScale: ${currentCenterScale.toFixed(2)}`, 20, 80);

    // Calculate offscreen memory usage for tinted sprite image 
    // (assuming offscreen dimensions equal to spriteImg dimensions)
    const offscreenMemory = getOffscreenMemoryUsage(spriteImg.width, spriteImg.height);
    const offscreenText = `Offscreen Memory: ${offscreenMemory}`;

    // Measure the text width to right-align it with a 20px margin.
    const offscreenTextWidth = context.measureText(offscreenText).width;
    context.fillText(offscreenText, canvasWidth - offscreenTextWidth - 20, 20);

    // Display tinted sprite cache info: number of entries and total memory usage
    const cacheEntryCount = Object.keys(tintedSpriteCache).length;
    const cacheMemoryUsage = getCacheMemoryUsage();
    const cacheText = `Tinted Sprite Cache: ${cacheEntryCount} entries, ${cacheMemoryUsage}`;

    // Measure text width and draw below the offscreen text
    const cacheTextWidth = context.measureText(cacheText).width;
    context.fillText(cacheText, canvasWidth - cacheTextWidth - 20, 40);
};

// Global variables for angle speed updates and pause state
// Initialize angle speeds with random values between 0.001 and 0.011
let angleSpeedX = getRandomFloat(0.001, 0.011);
let angleSpeedY = getRandomFloat(0.001, 0.011);
let angleSpeedZ = getRandomFloat(0.001, 0.011);
let paused = false;

/**
 * updateInputValues updates the HTML input elements with the current angle speed values.
 */
function updateInputValues() {
    // Get the input elements by their IDs
    const angleXInput = document.getElementById('angleXSpeed');
    const angleYInput = document.getElementById('angleYSpeed');
    const angleZInput = document.getElementById('angleZSpeed');

    // Set the input values using toFixed to display three decimals
    if (angleXInput && angleYInput && angleZInput) {
        angleXInput.value = angleSpeedX.toFixed(3);
        angleYInput.value = angleSpeedY.toFixed(3);
        angleZInput.value = angleSpeedZ.toFixed(3);
    }
}

// Update the input values once the DOM content is loaded
document.addEventListener("DOMContentLoaded", updateInputValues);

/**
 * Event listener for input changes on the angle speed inputs.
 * Updates the global speed variables from the input values.
 */
document.getElementById('angleXSpeed').addEventListener('change', (e) => {
    angleSpeedX = parseFloat(e.target.value) || 0;
});
document.getElementById('angleYSpeed').addEventListener('change', (e) => {
    angleSpeedY = parseFloat(e.target.value) || 0;
});
document.getElementById('angleZSpeed').addEventListener('change', (e) => {
    angleSpeedZ = parseFloat(e.target.value) || 0;
});

/**
 * Keydown event listener for toggling the pause state when SPACEBAR is pressed.
 */
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        paused = !paused;
        event.preventDefault(); // Prevent scrolling or other default actions
    }
});

// Define a constant for center scale rendering threshold
const CENTER_RENDER_THRESHOLD = 1.18;

// Start the animation loop
animate();