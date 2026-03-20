// Town grid constants
export const GRID        = 8;        // 8×8 blocks
export const MAP_SIZE    = 500;      // total map side length
export const ROAD_WIDTH  = 12;       // road strip width (incl. kerb)
export const CELL_SIZE   = 61;       // one block cell = BLOCK + ROAD (49+12)
export const BLOCK_SIZE  = 49;       // usable block interior
export const HALF_MAP    = MAP_SIZE / 2; // 250

// Physics
export const GRAVITY              = -22;
export const PLAYER_SPEED         = 7;
export const PLAYER_SPRINT_SPEED  = 14;
export const PLAYER_JUMP_VEL      = 9;
export const PLAYER_HEIGHT        = 1.8;
export const PLAYER_RADIUS        = 0.38;

// Camera
export const CAM_FOV  = 72;
export const CAM_NEAR = 0.1;
export const CAM_FAR  = 600;   // fog ends at 500; no need to render beyond that
