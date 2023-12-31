const Point = require("@cozy-caves/utils").Point;
const Tile = require("../tile/tile");

class Partition {
    #partitionName = "Unnamed"; // Metadata to be used in the editor.
    #partitionColor = "white"; // Metadata to be used in the editor.
    #partitionIcon = "Circle"; // Metadata to be used in the editor.

    #lockRatio = true; // Whether X/Y ratio should stay the same.
    #lockX = false; // Whether X can scale.
    #lockY = false; // Whether Y can scale.
    #splitScalingOnX = false; // Whether X scaling will be in increments or using split scaling.
    #splitScalingOnY = false; // Whether Y scaling will be in increments or using split scaling.
    #incrementAmtX = 1; // Amount to increment by.
    #incrementAmtY = 1; // Amount to increment by.
    #xDir = 1; // Direction to scale in the X axis.
    #yDir = 1; // Direction to scale in the Y axis.

    #scaleCountX; // Number of times partition has scaled in the X axis.
    #scaleCountY; // Number of times partition has scaled in the Y axis.
    #maxEncountered; // Largest encountered X/Y positions in partition.
    #minEncountered; // Smallest encountered X/Y positions in partition.

    // Partition edges used for increment scaling. 
    #edgesRight = new Map(); 
    #edgesLeft = new Map();
    #edgesTop = new Map();
    #edgesBottom = new Map();

    #tiles = new Map(); // Tile map containing static partition information.
    #scaledTiles = new Map(); // Tile map containing dynamic partition information.

    /**
     * Creates a new partition and sets the 
     * scaling rules to their defaults.
     *
     * @constructor
     */
    constructor() {
        this.resetScaling();

        const hslToHex = (h, s, l) => {
            l /= 100;
            const a = s * Math.min(l, 1 - l) / 100;
            const f = n => {
                const k = (n + h / 30) % 12;
                const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
            };
            return `#${f(0)}${f(8)}${f(4)}`;
        }

        let h = 360 * Math.random();
        let s = 100;
        let l = 50 + 10 * Math.random();
        this.#partitionColor = hslToHex(h, s, l);
    }

    /**
     * Resets scaling rules to their defaults. Clears edges and
     * the dynamic partition tilemap, and re-explores every tile.
     */
    resetScaling() {
        this.#scaleCountX = 0;
        this.#scaleCountY = 0;
        this.#maxEncountered = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
        this.#minEncountered = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        this.#edgesRight.clear();
        this.#edgesLeft.clear();
        this.#edgesTop.clear();
        this.#edgesBottom.clear();
        this.#scaledTiles.clear();

        for (const [key, value] of this.#tiles.entries()) {
            this.#scaledTiles.set(key, value);
            this.#evaluatePoint(value.getPosition());
        }
    }

    /**
     * Scales the tile on the X axis.
     *
     * @param layout Parent layout.
     */
    scaleX(layout) {
        if (this.#lockX) return;

        this.#scaleCountX++;
        if (this.#splitScalingOnX) {
            // MULTIPLES LOGIC HERE.
        } else {
            switch (this.#xDir) {
                case 1:
                    this.#incrementScale(this.#edgesRight, layout);
                    break;
                case -1:
                    this.#incrementScale(this.#edgesLeft, layout);
                    break;
                case 0:
                    if (this.#incrementAmtX % 2 != 0) throw new Error("Number needs to be even for centre scaling.");
                    this.#incrementScale(this.#edgesLeft, layout, true);
                    this.#incrementScale(this.#edgesRight, layout, true);
                    break;
                default: 
                    throw new Error("Invalid scaling direction used");
            }
        }
    }

    /**
     * Scales the tile on the Y axis.
     *
     * @param layout Parent layout.
     */
    scaleY(layout) {
        if (this.#lockY) return;

        this.#scaleCountY++;
        if (this.#splitScalingOnY) {
            // MULTIPLES LOGIC HERE.
        } else {
            switch (this.#yDir) {
                case 1:
                    this.#incrementScale(this.#edgesBottom, layout);
                    break;
                case -1:
                    this.#incrementScale(this.#edgesTop, layout);
                    break;
                case 0:
                    if (this.#incrementAmtY % 2 != 0) throw new Error("Number needs to be even for centre scaling.");
                    this.#incrementScale(this.#edgesBottom, layout, true);
                    this.#incrementScale(this.#edgesTop, layout, true);
                    break;
                default: 
                    throw new Error("Invalid scaling direction used");
            }
        }
    }    

    /**
     * Scales by increment along an axis, decided by the
     * given edge map.
     *
     * @param edgeMap Edge map to use as the increment origin.
     * @param layout Parent layout.
     */
    #incrementScale(edgeMap, layout, halved = false) {
        let xAxis = edgeMap === this.#edgesRight || edgeMap === this.#edgesLeft;
        let scaleDir = edgeMap === this.#edgesRight || edgeMap === this.#edgesBottom ? 1 : -1
        for (const [key, value] of edgeMap.entries()) {
            let edgePos = xAxis ? new Point(value, key) : new Point(key, value);
            let edgeTile = this.#scaledTiles.get(edgePos.toString());
            let incrementAmt = xAxis ? this.#incrementAmtX : this.#incrementAmtY;
            if (halved) incrementAmt /= 2;
            for (let i = 1; i <= incrementAmt; i++) {
                let posChange = xAxis ? new Point(i * scaleDir, 0) : new Point(0, i * scaleDir);
                let newPos = new Point(edgePos.getX() + posChange.getX(), edgePos.getY() + posChange.getY());
                let newTile = edgeTile.clone(newPos);
                layout.removeEditableTile(newTile.getPosition());
                this.#scaledTiles.set(newPos.toString(), newTile);
                this.#evaluatePoint(newTile.getPosition());
            }
        }
    }

    /**
     * Evaluates a point and updates edge maps as well
     * as max/min encountered points accordingly.
     *
     * @param pos Position to evaluate.
     */
    #evaluatePoint(pos) {
        if (!this.#edgesLeft.has(pos.getY()) || this.#edgesLeft.get(pos.getY()) > pos.getX()) this.#edgesLeft.set(pos.getY(), pos.getX());
        if (!this.#edgesRight.has(pos.getY()) || this.#edgesRight.get(pos.getY()) < pos.getX()) this.#edgesRight.set(pos.getY(), pos.getX());
        if (!this.#edgesTop.has(pos.getX()) || this.#edgesTop.get(pos.getX()) > pos.getY()) this.#edgesTop.set(pos.getX(), pos.getY());
        if (!this.#edgesBottom.has(pos.getX()) || this.#edgesBottom.get(pos.getX()) < pos.getY()) this.#edgesBottom.set(pos.getX(), pos.getY());
        if (this.#maxEncountered.getX() < pos.getX()) this.#maxEncountered.setX(pos.getX());
        if (this.#maxEncountered.getY() < pos.getY()) this.#maxEncountered.setY(pos.getY());
        if (this.#minEncountered.getX() > pos.getX()) this.#minEncountered.setX(pos.getX());
        if (this.#minEncountered.getY() > pos.getY()) this.#minEncountered.setY(pos.getY());
    }

    /**
     * Adds a tile to the static tile map.
     *
     * @param tile Tile to add.
     */
    addTile(tile) { 
        this.#tiles.set(tile.getPosition().toString(), tile); 
    }

    /**
     * Removes a tile from the static tile map.
     * 
     * @param pos Pos of tie to remove. 
     */
    removeTile(pos) {
        this.#tiles.delete(pos.toString());
    }

    /**
     * Gets a tile from the static tile map.
     * 
     * @param pos Position of tile to get.
     */
    getTile(pos) {
        return this.#tiles.get(pos.toString());
    }

    /**
     * Removes a tile from the dynamic tile map.
     * Recalculates edge maps and max/min encountered points.
     *
     * @param pos Position of tile to remove.
     */
    removeScaledTile(pos) {
        if (!this.#scaledTiles.delete(pos.toString())) return;

        this.#maxEncountered = new Point(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
        this.#minEncountered = new Point(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        this.#edgesRight.clear();
        this.#edgesLeft.clear();
        this.#edgesTop.clear();
        this.#edgesBottom.clear();
        for (const value of this.#scaledTiles.values()) {
            this.#evaluatePoint(value.getPosition());
        }
    }

    // Setters
    setPartitionName(partitionName) { this.#partitionName = partitionName.toString(); }
    setPartitionColor(partitionColor) { this.#partitionColor = partitionColor.toString(); }
    setPartitionIcon(partitionIcon) { this.#partitionIcon = partitionIcon.toString(); }
    setLockRatio(lockRatio) { this.#lockRatio = !!lockRatio; }
    setLockX(lockX) { this.#lockX = !!lockX; }
    setLockY(lockY) { this.#lockY = !!lockY; }
    setSplitScalingOnX(splitScalingOnX) { this.#splitScalingOnX = !!splitScalingOnX; }
    setSplitScalingOnY(splitScalingOnY) { this.#splitScalingOnY = !!splitScalingOnY; }
    setIncrementAmtX(incrementAmtX) { 
        if (!Number.isInteger(incrementAmtX) || incrementAmtX <= 0) throw new Error('Invalid increment amount provided.');
        this.#incrementAmtX = incrementAmtX; 
    }
    setIncrementAmtY(incrementAmtY) { 
        if (!Number.isInteger(incrementAmtY) || incrementAmtY <= 0) throw new Error('Invalid increment amount provided.');
        this.#incrementAmtY = incrementAmtY; 
    }
    setXDir(xDir) {
        if (!Number.isInteger(xDir) || xDir < -1 || xDir > 1) throw new Error('Invalid X direction provided.');
        this.#xDir = xDir; 
    }
    setYDir(yDir) {
        if (!Number.isInteger(yDir) || yDir < -1 || yDir > 1) throw new Error('Invalid Y direction provided.');
        this.#yDir = yDir; 
    }

    // Getters
    getPartitionName() { return this.#partitionName; }
    getPartitionColor() { return this.#partitionColor; }
    getPartitionIcon() { return this.#partitionIcon; }
    ratioLocked() { return this.#lockRatio; }
    xLocked() { return this.#lockX; }
    yLocked() { return this.#lockY; }
    isSplitScalingOnX() { return this.#splitScalingOnX; }
    isSplitScalingOnY() { return this.#splitScalingOnY; }
    getIncrementAmtX() { return this.#incrementAmtX; }
    getIncrementAmtY() { return this.#incrementAmtY; }
    getXDir() { return this.#xDir; }
    getYDir() { return this.#yDir; }
    getMaxEncountered() { return this.#scaledTiles.size > 0 ? this.#maxEncountered.clone() : null; }
    getMinEncountered() { return this.#scaledTiles.size > 0 ? this.#minEncountered.clone() : null; }
    getScaleCountX() { return this.#scaleCountX; }
    getScaleCountY() { return this.#scaleCountY; }
    getTiles() { return this.#tiles; }
    getScaledTiles() { return Array.from(this.#scaledTiles.values()); }

    /**
     * Creates a new object with information needed to save the partition.
     * 
     * @returns Serializable partition object.
     */
    getSerializablePartition() {
        return {
            name: this.#partitionName,
            color: this.#partitionColor,
            icon: this.#partitionIcon,
            lockRatio: this.#lockRatio,
            lockX: this.#lockX,
            lockY: this.#lockY,
            splitScalingOnX: this.#splitScalingOnX,
            splitScalingOnY: this.#splitScalingOnY,
            incrementAmtX: this.#incrementAmtX,
            incrementAmtY: this.#incrementAmtY,
            xDir: this.#xDir,
            yDir: this.#yDir,
            tiles: Array.from(this.#tiles.values()).map(tile => tile.getSerializableTile())
        };
    }
}

module.exports = Partition;
