import { create } from 'zustand'

type Installation = {
  id: string
  customer: string
  status: 'pending' | 'in-progress' | 'completed'
}

export type InterventionForm = {
  client: string
  vehicleMakeModel: string
  immatriculation: string
  year: string
  odometer: string
  chassis: string
  operatorCode: string
  country: string
  simNumber: string
  imsi: string
  antivol: boolean
  geolocation: boolean
  fleetManagement: boolean
  otherOption: boolean
  camera: boolean
  alarm: boolean
  buzzer: boolean
  canClick: boolean
  alimentationRed: boolean
  alimentationYellow: boolean
  acc: boolean
  immobilisationCable: boolean
  fuelGauge: boolean
  canH: boolean
  canL: boolean
  observations: string
  battery12vOk: boolean
  kitGpsConnected: boolean
  engineStartsWell: boolean
  dashboardDefaults: boolean
  buttonsDefaults: boolean
  climRadioDefaults: boolean
  installerName: string
  date: string
}

type AppState = {
  technicianName: string
  installations: Installation[]
  currentForm: InterventionForm
  submittedForms: InterventionForm[]
  setTechnicianName: (name: string) => void
  addInstallation: (installation: Omit<Installation, 'id'>) => void
  updateInstallationStatus: (id: string, status: Installation['status']) => void
  updateFormField: <K extends keyof InterventionForm>(field: K, value: InterventionForm[K]) => void
  submitForm: () => void
  resetForm: () => void
}

export const useAppStore = create<AppState>((set) => ({
  technicianName: '',
  installations: [],
  currentForm: {
    client: '',
    vehicleMakeModel: '',
    immatriculation: '',
    year: '',
    odometer: '',
    chassis: '',
    operatorCode: '',
    country: '',
    simNumber: '',
    imsi: '',
    antivol: false,
    geolocation: false,
    fleetManagement: false,
    otherOption: false,
    camera: false,
    alarm: false,
    buzzer: false,
    canClick: false,
    alimentationRed: false,
    alimentationYellow: false,
    acc: false,
    immobilisationCable: false,
    fuelGauge: false,
    canH: false,
    canL: false,
    observations: '',
    battery12vOk: false,
    kitGpsConnected: false,
    engineStartsWell: false,
    dashboardDefaults: false,
    buttonsDefaults: false,
    climRadioDefaults: false,
    installerName: '',
    date: '',
  },
  submittedForms: [],
  setTechnicianName: (technicianName) => set({ technicianName }),
  addInstallation: (installation) =>
    set((state) => ({
      installations: [
        ...state.installations,
        {
          ...installation,
          id: crypto.randomUUID(),
        },
      ],
    })),
  updateInstallationStatus: (id, status) =>
    set((state) => ({
      installations: state.installations.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    })),
  updateFormField: (field, value) =>
    set((state) => ({
      currentForm: {
        ...state.currentForm,
        [field]: value,
      },
    })),
  submitForm: () =>
    set((state) => ({
      submittedForms: [...state.submittedForms, state.currentForm],
    })),
  resetForm: () =>
    set((state) => ({
      currentForm: {
        ...state.currentForm,
        client: '',
        vehicleMakeModel: '',
        immatriculation: '',
        year: '',
        odometer: '',
        chassis: '',
        operatorCode: '',
        country: '',
        simNumber: '',
        imsi: '',
        observations: '',
        installerName: '',
        date: '',
      },
    })),
}))

