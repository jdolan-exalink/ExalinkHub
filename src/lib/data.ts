import type { Camera, FrigateEvent, FrigateServer } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getImage = (id: string) => {
    const image = PlaceHolderImages.find(img => img.id === id);
    return image ? image.imageUrl : 'https://picsum.photos/seed/default/300/200';
}

export const CAMERAS: Camera[] = [
  { 
    id: 'Pasillo', 
    name: 'Pasillo', 
    enabled: true,
    recording: true,
    detection: true,
    snapshots: true,
    streamUrl: 'http://10.1.1.252:5000/api/Pasillo',
    snapshotUrl: 'http://10.1.1.252:5000/api/Pasillo/latest.jpg',
    server: 'Casa'
  },
  { 
    id: 'Cochera', 
    name: 'Cochera', 
    enabled: true,
    recording: true,
    detection: true,
    snapshots: true,
    streamUrl: 'http://10.1.1.252:5000/api/Cochera',
    snapshotUrl: 'http://10.1.1.252:5000/api/Cochera/latest.jpg',
    server: 'Casa'
  },
  { 
    id: 'Quincho', 
    name: 'Quincho', 
    enabled: true,
    recording: true,
    detection: true,
    snapshots: true,
    streamUrl: 'http://10.1.1.252:5000/api/Quincho',
    snapshotUrl: 'http://10.1.1.252:5000/api/Quincho/latest.jpg',
    server: 'Casa'
  },
  { 
    id: 'Baldio', 
    name: 'Baldio', 
    enabled: true,
    recording: true,
    detection: true,
    snapshots: true,
    streamUrl: 'http://10.1.1.252:5000/api/Baldio',
    snapshotUrl: 'http://10.1.1.252:5000/api/Baldio/latest.jpg',
    server: 'Casa'
  },
  { 
    id: 'camera-5', 
    name: 'Cámara 5', 
    enabled: false,
    recording: false,
    detection: false,
    snapshots: false,
    streamUrl: '',
    snapshotUrl: '',
    server: 'Casa'
  },
  { 
    id: 'camera-6', 
    name: 'Cámara 6', 
    enabled: false,
    recording: false,
    detection: false,
    snapshots: false,
    streamUrl: '',
    snapshotUrl: '',
    server: 'Casa'
  },
];

export const EVENTS: FrigateEvent[] = [
  {
    id: 'evt-1',
    camera: 'Driveway',
    label: 'car',
    start_time: Date.now() - 1000 * 60 * 2,
    zones: ['driveway_entrance'],
    image: getImage('event_car'),
    has_clip: true,
    has_snapshot: true,
    score: 0.92,
    top_score: 0.96,
  },
  {
    id: 'evt-2',
    camera: 'Front Door',
    label: 'person',
    start_time: Date.now() - 1000 * 60 * 5,
    zones: ['front_porch'],
    image: getImage('event_person'),
    has_clip: true,
    has_snapshot: true,
    score: 0.88,
    top_score: 0.93,
  },
  {
    id: 'evt-3',
    camera: 'Driveway',
    label: 'license_plate',
    start_time: Date.now() - 1000 * 60 * 8,
    zones: ['driveway_entrance'],
    image: getImage('event_lpr'),
    has_clip: true,
    has_snapshot: true,
    score: 0.95,
    top_score: 0.98,
  },
  {
    id: 'evt-4',
    camera: 'Backyard',
    label: 'dog',
    start_time: Date.now() - 1000 * 60 * 15,
    zones: ['lawn'],
    image: getImage('event_dog'),
    has_clip: true,
    has_snapshot: true,
    score: 0.9,
    top_score: 0.94,
  },
  {
    id: 'evt-5',
    camera: 'Garage',
    label: 'person',
    start_time: Date.now() - 1000 * 60 * 22,
    zones: ['garage_door'],
    image: getImage('event_person_2'),
    has_clip: true,
    has_snapshot: true,
    score: 0.87,
    top_score: 0.9,
  },
  {
    id: 'evt-6',
    camera: 'Driveway',
    label: 'car',
    start_time: Date.now() - 1000 * 60 * 30,
    zones: ['street'],
    image: getImage('event_car_2'),
    has_clip: true,
    has_snapshot: true,
    score: 0.91,
    top_score: 0.95,
  },
    {
    id: 'evt-7',
    camera: 'Front Door',
    label: 'cat',
    start_time: Date.now() - 1000 * 60 * 45,
    zones: ['walkway'],
    image: getImage('event_cat'),
    has_clip: false,
    has_snapshot: false,
    score: 0.5,
    top_score: 0.6,
  },
];

export const SERVERS: FrigateServer[] = [
    {
        id: 'server-1',
        name: 'Casa',
        url: 'http://10.1.1.252:5000',
        status: 'online' as const,
        version: '0.16.0'
    },
    {
        id: 'server-2',
        name: 'Workshop',
        url: 'http://192.168.1.101:5000',
        status: 'offline' as const
    }
];
