
export const BLE_CONFIG = {
  DEVICE_MAC_ADDRESS: '34:81:F4:33:AE:91',
  DEVICE_NAME_FILTER: null,
  
  DATA_SERVICE_UUIDS: [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
  ],
  
  DATA_SERVICE_UUID: "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  DATA_CHARACTERISTIC_UUID: "49535343-1e4d-4bd9-ba61-23c647249616",
  
  SYNC_BYTES: [0xAA, 0xAA],
  CODE_LENGTHS: {
    0x02: 1,  // Poor signal
    0x04: 1,  // Attention
    0x05: 1,  // Meditation
    0x80: 2,  // Raw EEG (16-bit signed)
    0x83: 24, // EEG band powers (8 bands × 3 bytes each)
  },
  
  MAX_POINTS: 300,
  SAMPLING_RATE: 256, // Hz
  
  EEG_BANDS: [
    'Delta',
    'Theta', 
    'AlphaLow',
    'AlphaHigh',
    'BetaLow',
    'BetaHigh',
    'GammaLow',
    'GammaHigh'
  ]
};