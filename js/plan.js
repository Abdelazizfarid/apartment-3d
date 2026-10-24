// Apartment geometry and the proposed layout. Units: meters. x = east along the plan, z = south.
// Walls / floor / windows were extracted from the vector lines of the as-built PDF (scale 38.5 pt = 1 m).

export const PLAN = {"walls":[[13.094,0.0,14.119,0.104],[15.535,0.0,16.561,0.26],[12.029,0.117,14.119,0.26],[9.574,0.117,10.613,0.39],[12.029,0.273,13.158,0.39],[3.73,0.156,5.314,0.416],[-0.023,0.156,1.704,0.416],[9.574,0.403,9.782,0.494],[5.029,0.429,5.314,0.494],[16.327,0.273,16.561,0.506],[5.029,0.506,6.055,0.766],[7.003,0.506,8.21,0.766],[9.145,0.506,9.782,0.792],[-0.023,0.429,0.418,0.935],[5.029,0.779,5.366,1.026],[9.405,0.805,9.782,1.026],[-0.023,0.948,0.275,1.221],[16.171,1.104,20.275,1.286],[12.808,0.403,13.158,1.299],[9.574,1.039,9.782,1.325],[18.003,1.286,18.6,1.429],[16.171,1.286,16.444,1.779],[9.405,1.338,9.782,1.857],[19.99,1.286,20.275,2.545],[7.717,0.805,7.847,3.143],[9.574,1.87,9.782,3.143],[12.964,1.312,13.158,3.286],[7.717,3.156,7.873,3.286],[8.769,3.156,11.977,3.286],[12.964,3.299,13.132,3.364],[-0.023,2.429,0.275,4.195],[-0.023,4.208,0.639,4.273],[3.366,4.208,3.704,4.273],[5.34,4.286,8.145,4.39],[-0.023,4.286,4.236,4.39],[16.327,1.792,16.444,4.403],[5.366,4.39,8.145,4.429],[-0.023,4.39,4.21,4.429],[-0.023,4.429,4.236,4.545],[5.34,4.455,7.236,4.545],[12.964,4.403,16.444,4.571],[15.262,4.584,15.418,4.623],[19.99,4.208,20.275,5.494],[17.769,5.39,18.613,5.494],[8.886,5.39,9.782,5.494],[12.847,5.403,13.743,5.494],[15.262,5.455,15.418,5.494],[6.951,4.558,7.236,5.571],[8.886,5.494,20.275,5.571],[6.951,5.571,20.275,5.857]],"floor":[[0.418,0.429,5.029,0.935],[5.366,0.779,7.717,1.026],[7.847,0.805,9.405,1.026],[0.275,0.948,5.029,1.026],[13.158,0.273,16.327,1.091],[9.782,0.403,12.808,1.299],[7.847,1.039,9.574,1.325],[18.6,1.286,19.99,1.429],[16.444,1.286,18.003,1.429],[13.158,1.104,16.171,1.779],[7.847,1.338,9.405,1.857],[9.782,1.312,12.964,3.143],[7.847,1.87,9.574,3.143],[0.275,1.039,7.717,3.286],[13.158,1.792,16.327,3.286],[7.873,3.156,8.769,3.286],[11.977,3.156,12.964,3.286],[13.132,3.299,16.327,3.364],[0.275,3.299,12.964,3.364],[0.275,3.377,16.327,4.195],[3.704,4.208,16.327,4.273],[0.639,4.208,3.366,4.273],[8.145,4.286,16.327,4.377],[4.236,4.286,5.34,4.39],[4.21,4.39,5.366,4.429],[8.145,4.39,12.964,4.442],[16.444,1.442,19.99,4.571],[7.236,4.455,12.964,4.571],[15.418,4.584,19.99,4.623],[7.236,4.584,15.262,4.623],[7.236,4.636,19.99,5.377],[18.613,5.39,19.99,5.494],[9.782,5.403,12.847,5.494],[15.418,5.403,17.769,5.494],[13.743,5.455,15.262,5.494],[7.236,5.39,8.886,5.571]],"windows":[[0.0,1.231,0.252,2.426],[1.709,0.156,3.719,0.405],[6.06,0.506,6.995,0.758],[16.343,0.512,16.535,1.094],[14.122,0.0,15.53,0.249],[10.613,0.125,12.021,0.377],[8.21,0.506,9.135,0.779],[20.003,2.548,20.252,4.205]]};

export const WALL_H = 2.9;      // finished ceiling height
export const SILL = 0.9;
export const WIN_TOP = 2.2;
export const DOOR_H = 2.25;

// Reception west wall replaced by floor-to-ceiling panorama glazing onto the triangular balcony
// (balcony outline from the as-built PDF: 1.20 m deep at the north end, tapering to the wall at the south).
export const PANORAMA = [-0.023, 0.94, 0.275, 4.2];
export const BALCONY = [[0, 0.678], [-1.208, 0.678], [0, 4.156]];

// Room interiors (axis-aligned rectangles, inner wall faces) used for floor finishes, labels and lights.
export const ROOMS = [
  { name: 'Reception',      rects: [[0.252, 0.405, 4.6, 4.286]], floor: 'existing_tile' , cove: true },
  { name: 'Balcony',        rects: [[-1.208, 0.678, -0.023, 4.156]], floor: 'travertine', outdoor: true },
  { name: 'Dining',         rects: [[4.6, 0.758, 7.730, 4.286]], floor: 'existing_tile' , cove: true },
  { name: 'Main bathroom',  rects: [[7.851, 0.779, 9.420, 3.161]], floor: 'stone_grey' },
  { name: 'Kitchen',        rects: [[9.758, 0.377, 12.83, 3.161]], floor: 'white_porcelain' },
  { name: 'Bedroom',        rects: [[13.137, 0.249, 16.343, 4.421]], floor: 'wood_tile', skirting: 'wood_skirt' , cove: true },
  { name: 'Master bedroom', rects: [[16.423, 1.261, 20.0, 5.512], [15.40, 4.56, 16.43, 5.512]], floor: 'wood_tile', skirting: 'wood_skirt' , cove: true },
  { name: 'Corridor',       rects: [[7.20, 4.42, 15.28, 5.512], [7.85, 3.28, 12.98, 4.42]], floor: 'existing_tile', noLabel: true },
];

// Door openings (rect in plan) and the open leaf exactly as drawn on the plan.
export const DOORS = [
  { name: 'Entrance',     open: [4.21, 4.286, 5.36, 4.54],  leaf: [5.22, 3.24, 5.30, 4.16], main: true },
  { name: 'Dining',       open: [7.73, 3.28, 7.851, 4.286], leaf: [7.95, 4.17, 8.75, 4.23] },
  { name: 'Bathroom',     open: [7.851, 3.161, 8.78, 3.28], leaf: [7.90, 2.32, 7.96, 3.07] },
  { name: 'Kitchen',      open: [11.95, 3.161, 12.987, 3.28], leaf: [12.87, 2.23, 12.93, 3.06] },
  { name: 'Bedroom',      open: [12.987, 3.35, 13.137, 4.40], leaf: [13.21, 4.28, 14.05, 4.34] },
  { name: 'Master',       open: [15.28, 4.62, 15.40, 5.45], leaf: [15.48, 5.40, 16.25, 5.46] },
];

// Wall finishes applied as thin cladding on wall faces: [x1, z1, x2, z2, y1, y2, finish]
export const CLADDING = [
  // Reception: full-height fluted walnut TV wall
  [0.45, 4.236, 3.85, 4.286, 0, 2.9, 'fluted'],
  // Bedroom: fluted walnut behind the bed
  [13.137, 0.30, 13.177, 2.98, 0, 2.9, 'fluted'],
  // Master: built-out fluted headboard wall (hides the column niche)
  [16.90, 1.261, 20.0, 1.43, 0, 2.9, 'fluted'],
  // Bathroom: warm grey large-format porcelain on every wall
  [7.851, 0.779, 7.871, 3.161, 0, 2.9, 'stone_grey'],
  [7.851, 0.779, 9.420, 0.799, 0, 2.9, 'stone_grey'],
  [9.400, 0.779, 9.420, 3.161, 0, 2.9, 'stone_grey'],
  [8.780, 3.141, 9.420, 3.161, 0, 2.9, 'stone_grey'],
  // Kitchen: marble backsplash
  [9.758, 0.377, 12.83, 0.397, 0.9, 1.55, 'calacatta'],
  [9.758, 0.377, 9.778, 2.55, 0.9, 1.55, 'calacatta'],
];

// Ceiling area lights per room: [x, z, width, depth, intensity]
export const LIGHTS = [
  [2.65, 2.35, 3.2, 2.6, 6], [6.4, 2.3, 1.6, 1.4, 5], [8.65, 1.95, 1.0, 1.6, 2.2], [11.3, 1.75, 2.4, 1.8, 6],
  [14.75, 2.3, 2.4, 2.8, 5], [18.2, 3.4, 2.6, 3.0, 5], [11.2, 4.95, 6.5, 0.6, 5], [8.4, 3.8, 0.8, 0.8, 4],
];

// Proposed layout: [type, x, z, rotation°, w, d, h, y]; rotation 0 = front faces south (+z).
export const PROPOSAL = [
  // Reception
  ['sofa_l', 2.815, 1.515, 0, 4.35, 1.81],      // runs to the wall pier at x≈5.0
  ['rug_abstract', 2.475, 2.345, 0, 4.05, 3.49],   // wall-to-wall carpet, ~20 cm tile edge
  ['coffee_round', 2.0, 2.6, 0, 1.0, 1.0, 0.42],
  ['tv_console', 2.15, 4.046, 180, 2.6, 0.38, 0.32, 0.22],
  ['tv', 2.15, 4.21, 180, 1.68, 0.04, 0.97, 1.0],
  ['lounge_chair', 0.95, 3.4, 135],
  ['floor_lamp', 0.55, 2.8, 0],
  ['curtain_open', 0.355, 2.57, 90, 3.4], ['curtain', 2.715, 0.48, 0, 2.6],
  // Dining
  ['rug_border', 6.125, 2.525, 0, 2.85, 3.15],
  ['dining_round', 6.2, 2.5, 0, 1.3, 1.3],
  ['dining_chair', 6.91, 2.91, -120], ['dining_chair', 6.20, 3.32, -180], ['dining_chair', 5.49, 2.91, 120],
  ['dining_chair', 5.49, 2.09, 60], ['dining_chair', 6.20, 1.68, 0], ['dining_chair', 6.91, 2.09, -60],
  ['pendant', 6.2, 2.5, 0],
  ['flowers', 6.2, 2.5, 0, 0.3, 0.2, 0.3, 0.76],
  ['sideboard', 7.5, 2.0, -90, 1.6, 0.45, 0.75],
  ['mirror_round', 7.715, 2.0, -90, 0.9, 0.03, 0.9, 1.25],
  ['vase', 7.5, 1.55, 0, 0.23, 0.23, 0.6, 0.75],
  ['curtain', 6.53, 0.83, 0, 1.4],
  // Bathroom
  ['toilet', 8.06, 1.07, 0],
  ['water_heater', 8.065, 1.95, 90, 0.36, 0.36, 0.55, 2.0],   // compact 30 L, high up near the ceiling
  ['bath_mat', 8.55, 2.75, 0, 0.8, 0.5],
  // Bathroom: sink by the door, shower cabin in the back corner beside the toilet
  ['vanity', 9.17, 2.62, -90, 0.8, 0.46],
  ['mirror_led', 9.40, 2.62, -90, 0.7, 0.03, 0.7, 1.25],
  ['shower', 9.025, 1.49, 0, 0.75, 1.38],          // full length along the right wall, up to the sink
  // Kitchen
  ['counter', 10.184, 0.677, 0, 0.85], ['hob_unit', 11.06, 0.677, 0, 0.9],
  ['dishwasher', 11.81, 0.677, 0, 0.6], ['fridge', 12.52, 0.677, 0, 0.61, 0.6, 2.4],
  ['counter', 10.058, 1.14, 90, 0.32], ['sink_unit', 10.058, 1.75, 90, 0.9], ['counter', 10.058, 2.375, 90, 0.35],
  ['counter', 10.058, 2.855, 90, 0.61],
  // worktop accessories
  ['coffee_machine', 10.05, 0.58, 0], ['kettle', 10.4, 0.6, 0],
  ['knife_block', 11.85, 0.6, 0], ['cutlery_caddy', 9.95, 1.12, 90], ['utensil_jar', 9.92, 2.33, 90], ['oil_set', 9.92, 2.62, 90],
  ['fruit_bowl', 10.66, 2.9, 180], ['toaster', 11.35, 2.98, 180],
  // upper kitchen: wall cabinets on the left wall, left of the window and over the counter by the door
  ['wall_cab', 9.933, 1.955, 90, 2.4, 0.35, 0.8, 1.5], ['wall_cab', 10.19, 0.572, 0, 0.8, 0.35, 0.8, 1.5],
  ['wall_cab', 11.02, 2.986, 180, 1.32, 0.35, 0.8, 1.5],
  ['washer_int', 10.66, 2.861, 180, 0.6], ['counter', 11.32, 2.861, 180, 0.72],
  ['rug_runner', 11.45, 1.45, 0, 1.8, 0.7],
  // Bedroom: two single beds with a shared nightstand; L-shaped study desk where the wardrobe was
  ['bed', 14.14, 0.82, 90, 0.9, 2.0], ['bed', 14.14, 2.27, 90, 0.9, 2.0],
  ['nightstand', 13.36, 1.545, 90],
  ['table_lamp', 13.36, 1.545, 0, 0.32, 0.32, 0.55, 0.5],
  ['rug_shag', 14.75, 2.335, 0, 2.8, 3.77],
  ['desk_l', 15.543, 3.175, -90, 2.45, 1.6],
  ['office_chair', 15.2, 3.05, 90],
  ['wardrobe', 16.06, 1.55, -90, 0.78, 0.55, 2.2],
  ['curtain', 14.826, 0.33, 0, 2.0], ['curtain', 16.26, 0.8, -90, 1.0],
  // Master bedroom
  ['bed', 18.62, 2.48, 0, 1.8, 2.1],
  ['nightstand', 17.5, 1.655, 0, 0.55, 0.45], ['nightstand', 19.72, 1.655, 0, 0.55, 0.45],
  ['table_lamp', 17.5, 1.655, 0, 0.32, 0.32, 0.55, 0.5], ['table_lamp', 19.72, 1.655, 0, 0.32, 0.32, 0.55, 0.5],
  ['rug_border', 18.2, 3.39, 0, 3.2, 3.88],
  ['bench', 18.62, 3.8, 0, 1.5, 0.42],
  ['wardrobe', 16.723, 2.85, 90, 2.7, 0.6, 2.85],
  // TV wall facing the bed, on the free wall between wardrobe and dresser
  ['tv', 18.19, 5.368, 180, 1.23, 0.04, 0.71, 1.15], ['tv_console', 18.19, 5.20, 180, 1.1, 0.38, 0.3, 0.3],
  ['desk', 19.37, 5.262, 180, 1.2, 0.5], ['vanity_set', 19.37, 5.262, 180, 1.1, 0.42, 0.3, 0.76], ['vanity_stool', 19.37, 4.8, 0],
  ['mirror_round', 19.37, 5.49, 180, 0.8, 0.03, 0.8, 1.15],
  ['curtain', 19.92, 3.375, -90, 2.3],
  // Balcony
  ['plant_tree', -0.4, 1.05, 0], ['plant_bush', -0.3, 1.75, 0],
  // Corridor
  ['rug_runner', 10.4, 3.85, 0, 4.8, 0.95], ['rug_runner', 14.075, 5.035, 0, 2.15, 0.63],
  ['art', 12.4, 5.49, 180, 0.9, 0.04, 0.6, 1.3],
  // curved office pod (sliding curved glass door) with ergonomic chair
  ['office_pod_curve', 8.19, 4.994, 180, 1.9, 1.0, 2.5], ['office_chair', 8.19, 4.86, 0],   // in the west corner, lengthwise
  // shoe cabinet with mirror and wall lights on the freed wall
  ['shoe_cabinet', 10.3, 5.334, 180, 1.4, 0.32, 0.85, 0.12], ['mirror_round', 10.3, 5.474, 180, 0.8, 0.03, 0.8, 1.3],
  ['wall_sconce', 9.4, 5.42, 180], ['wall_sconce', 11.2, 5.42, 180],
];
