/**
 * Reference-only geospatial overlays used to explain the concept UI.
 * These hand-selected coordinates are never presented as live or complete datasets.
 */

/**
 * Canonical Line Table mapping across LTA endpoints
 * Addresses the trap identified in Section 2.4 of the problem brief.
 */
export const CANONICAL_LINE_MAP: Record<string, { alertCode: string; crowdCode: string; name: string; color: string }> = {
  PUN_LRT: { alertCode: 'PTL', crowdCode: 'PLRT', name: 'Punggol LRT', color: '#708090' },
  SK_LRT: { alertCode: 'STL', crowdCode: 'SLRT', name: 'Sengkang LRT', color: '#708090' },
  BP_LRT: { alertCode: 'BPL', crowdCode: 'BPL', name: 'Bukit Panjang LRT', color: '#708090' },
  NEL: { alertCode: 'NEL', crowdCode: 'NEL', name: 'North East Line', color: '#9900aa' },
  CCL: { alertCode: 'CCL', crowdCode: 'CCL', name: 'Circle Line', color: '#fa9e0d' },
  CEL: { alertCode: 'CCL', crowdCode: 'CEL', name: 'Circle Line Extension', color: '#fa9e0d' },
  EWL: { alertCode: 'EWL', crowdCode: 'EWL', name: 'East West Line', color: '#009645' },
  CGL: { alertCode: 'EWL', crowdCode: 'CGL', name: 'Changi Extension', color: '#009645' },
  NSL: { alertCode: 'NSL', crowdCode: 'NSL', name: 'North South Line', color: '#d42e12' },
  DTL: { alertCode: 'DTL', crowdCode: 'DTL', name: 'Downtown Line', color: '#005ec4' },
  TEL: { alertCode: 'TEL', crowdCode: 'TEL', name: 'Thomson-East Coast Line', color: '#9d5b25' },
};

export const PUNGGOL_ORIGIN = {
  lat: 1.4024,
  lng: 103.9068,
  address: 'Waterway Terraces II, Punggol Walk',
};

export const ONE_NORTH_DEST = {
  lat: 1.2995,
  lng: 103.7876,
  address: 'Fusionopolis One, 1 Fusionopolis Way, one-north',
};

// Key station coordinates
export const STATIONS = {
  DAMAI: { code: 'PE7', name: 'Damai LRT', lat: 1.4052, lng: 103.9085, line: 'PLRT' },
  OASIS: { code: 'PE6', name: 'Oasis LRT', lat: 1.4022, lng: 103.9128, line: 'PLRT' },
  PUNGGOL: { code: 'NE17/PTC', name: 'Punggol', lat: 1.4048, lng: 103.9022, line: 'NEL' },
  SERANGOON: { code: 'NE12/CC13', name: 'Serangoon', lat: 1.3500, lng: 103.8735, line: 'CCL' },
  BISHAN: { code: 'NS17/CC15', name: 'Bishan', lat: 1.3508, lng: 103.8481, line: 'CCL' },
  BUONA_VISTA: { code: 'EW21/CC22', name: 'Buona Vista', lat: 1.3073, lng: 103.7900, line: 'CCL' },
  ONE_NORTH: { code: 'CC23', name: 'one-north', lat: 1.2996, lng: 103.7874, line: 'CCL' },
  KENT_RIDGE: { code: 'CC24', name: 'Kent Ridge', lat: 1.2934, lng: 103.7845, line: 'CCL' },
};

/**
 * LTA CoveredLinkWay segments (Sheltered walkways)
 * REFERENCE OVERLAY: illustrative subset based on LTA CoveredLinkWay locations.
 */
export const COVERED_LINKWAYS: [number, number][][] = [
  // Damai LRT to Punggol Walk residential blocks
  [
    [1.4052, 103.9085],
    [1.4043, 103.9079],
    [1.4035, 103.9072],
    [1.4024, 103.9068],
  ],
  // Punggol MRT to Waterway Point & bus interchange
  [
    [1.4048, 103.9022],
    [1.4042, 103.9028],
    [1.4036, 103.9035],
    [1.4025, 103.9048],
  ],
  // one-north MRT CC23 to Fusionopolis / Biopolis covered link
  [
    [1.2996, 103.7874],
    [1.2992, 103.7878],
    [1.2985, 103.7884],
    [1.2978, 103.7891],
  ],
  // Buona Vista interchange to Metropolis & one-north park connector
  [
    [1.3073, 103.7900],
    [1.3055, 103.7895],
    [1.3032, 103.7887],
    [1.3015, 103.7880],
    [1.2996, 103.7874],
  ],
];

/**
 * LTA CyclingPath segments (Dedicated bike paths & Park Connector Network)
 * REFERENCE OVERLAY: illustrative subset based on LTA CyclingPath locations.
 */
export const CYCLING_PATHS: [number, number][][] = [
  // Punggol Waterway Park Connector (Scenic cycling leg)
  [
    [1.4024, 103.9068],
    [1.4038, 103.9082],
    [1.4065, 103.9055],
    [1.4080, 103.9020],
    [1.4060, 103.8995],
    [1.4048, 103.9022],
  ],
  // Punggol Central Cycling Network
  [
    [1.4048, 103.9022],
    [1.4010, 103.9040],
    [1.3980, 103.9070],
    [1.3965, 103.9105],
  ],
  // Buona Vista to one-north Rail Corridor & Innovation cycling link
  [
    [1.3080, 103.7910],
    [1.3045, 103.7898],
    [1.3010, 103.7882],
    [1.2995, 103.7876],
    [1.2965, 103.7865],
  ],
];
