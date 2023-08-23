const Point = require("../../../utils/src/point");

/**
 * Represents a tile in the room.
 * 
 * @author Abdulrahman Asfari
 */
class Tile {
    #tileType; // Type of tile to display.
    #position; // Position of the tile in the room.
    #offset = new Point(0, 0); // Rendering offset.
    #rotation = 0; // Rendering rotation.
    #depth = 0; // Rendering depth.

    /**
     * Creates an instance of Tile.
     *
     * @constructor
     * @param tileType Type of tile, e.g. "floor".
     * @param position Position of the tile in the room.
     */
    constructor(tileType, position) {
        if (!tileType || !(position instanceof Point)) throw new Error('Invalid tile provided.');
        this.#tileType = tileType.toString();
        this.#position = position;
    }

    // Getters.
    getTileType() { return this.#tileType; }
    getPosition() { return this.#position; }
    getOffset() { return this.#offset; }
    getRotation() { return this.#rotation; }
    getDepth() { return this.#depth; }

    /**
     * Creates a clone of the tile, optionally
     * at a new position
     *
     * @param pos New position to clone tile at.
     * @returns Cloned tile.
     */
    clone(pos = this.#position) { return new Tile(this.#tileType, pos.clone()); }
}

module.exports = Tile;
