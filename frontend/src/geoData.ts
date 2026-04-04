export interface Ward { id: string; name: string; }
export interface Lga { id: string; name: string; wards: Ward[]; }
export interface State { id: string; name: string; lgas: Lga[]; }

export const GEO_DATA: State[] = [
  {
    id: 'fct', name: 'Abuja (FCT)', lgas: [
      { id: 'fct-mac', name: 'Municipal Area Council', wards: [
        { id: 'fct-mac-garki', name: 'Garki' }, { id: 'fct-mac-wuse', name: 'Wuse' },
        { id: 'fct-mac-maitama', name: 'Maitama' }, { id: 'fct-mac-asokoro', name: 'Asokoro' },
        { id: 'fct-mac-gwarinpa', name: 'Gwarinpa' },
      ]},
      { id: 'fct-bwari', name: 'Bwari', wards: [
        { id: 'fct-bwari-central', name: 'Bwari Central' }, { id: 'fct-bwari-ushafa', name: 'Ushafa' },
        { id: 'fct-bwari-dutse', name: 'Dutse' },
      ]},
      { id: 'fct-gwag', name: 'Gwagwalada', wards: [
        { id: 'fct-gwag-central', name: 'Gwagwalada Central' }, { id: 'fct-gwag-dobi', name: 'Dobi' },
        { id: 'fct-gwag-zuba', name: 'Zuba' },
      ]},
    ],
  },
  {
    id: 'lagos', name: 'Lagos', lgas: [
      { id: 'lag-ikeja', name: 'Ikeja', wards: [
        { id: 'lag-ikeja-alausa', name: 'Alausa' }, { id: 'lag-ikeja-agidingbi', name: 'Agidingbi' },
        { id: 'lag-ikeja-oregun', name: 'Oregun' }, { id: 'lag-ikeja-ojodu', name: 'Ojodu' },
      ]},
      { id: 'lag-etiosa', name: 'Eti-Osa', wards: [
        { id: 'lag-etiosa-lekki', name: 'Lekki Phase 1' }, { id: 'lag-etiosa-vi', name: 'Victoria Island' },
        { id: 'lag-etiosa-ikoyi', name: 'Ikoyi' }, { id: 'lag-etiosa-ajah', name: 'Ajah' },
      ]},
      { id: 'lag-surulere', name: 'Surulere', wards: [
        { id: 'lag-sur-aguda', name: 'Aguda' }, { id: 'lag-sur-itire', name: 'Itire' },
        { id: 'lag-sur-bode', name: 'Bode Thomas' },
      ]},
    ],
  },
  {
    id: 'kano', name: 'Kano', lgas: [
      { id: 'kan-muni', name: 'Kano Municipal', wards: [
        { id: 'kan-muni-fagge', name: 'Fagge' }, { id: 'kan-muni-gwale', name: 'Gwale' },
        { id: 'kan-muni-dala', name: 'Dala' },
      ]},
      { id: 'kan-nass', name: 'Nassarawa', wards: [
        { id: 'kan-nass-central', name: 'Nassarawa Central' }, { id: 'kan-nass-tudun', name: 'Tudun Wada' },
      ]},
    ],
  },
  {
    id: 'rivers', name: 'Rivers', lgas: [
      { id: 'riv-ph', name: 'Port Harcourt', wards: [
        { id: 'riv-ph-dline', name: 'D-Line' }, { id: 'riv-ph-gra', name: 'GRA Phase 1' },
        { id: 'riv-ph-rumuola', name: 'Rumuola' }, { id: 'riv-ph-diobu', name: 'Diobu' },
      ]},
      { id: 'riv-obio', name: 'Obio-Akpor', wards: [
        { id: 'riv-obio-rumuigbo', name: 'Rumuigbo' }, { id: 'riv-obio-ozuoba', name: 'Ozuoba' },
      ]},
    ],
  },
  {
    id: 'oyo', name: 'Oyo', lgas: [
      { id: 'oyo-ibnorth', name: 'Ibadan North', wards: [
        { id: 'oyo-ibnorth-agodi', name: 'Agodi' }, { id: 'oyo-ibnorth-bodija', name: 'Bodija' },
        { id: 'oyo-ibnorth-sango', name: 'Sango' },
      ]},
      { id: 'oyo-ibsw', name: 'Ibadan South-West', wards: [
        { id: 'oyo-ibsw-okeado', name: 'Oke-Ado' }, { id: 'oyo-ibsw-iyaganku', name: 'Iyaganku' },
      ]},
    ],
  },
  {
    id: 'kaduna', name: 'Kaduna', lgas: [
      { id: 'kad-north', name: 'Kaduna North', wards: [
        { id: 'kad-north-kawo', name: 'Kawo' }, { id: 'kad-north-rigasa', name: 'Rigasa' },
        { id: 'kad-north-unguwan', name: 'Unguwan Rimi' },
      ]},
      { id: 'kad-south', name: 'Kaduna South', wards: [
        { id: 'kad-south-barnawa', name: 'Barnawa' }, { id: 'kad-south-makera', name: 'Makera' },
      ]},
    ],
  },
  {
    id: 'enugu', name: 'Enugu', lgas: [
      { id: 'enu-north', name: 'Enugu North', wards: [
        { id: 'enu-north-ogui', name: 'Ogui' }, { id: 'enu-north-abakpa', name: 'Abakpa' },
      ]},
      { id: 'enu-south', name: 'Enugu South', wards: [
        { id: 'enu-south-independence', name: 'Independence Layout' }, { id: 'enu-south-trans', name: 'Trans-Ekulu' },
      ]},
    ],
  },
];
