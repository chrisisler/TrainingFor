import firebase from 'firebase';

interface FirestoreDocument {
  id: string;
}

export interface User extends FirestoreDocument {
  displayName: string;
  logs: TrainingLog[];
}

export interface TrainingLog extends FirestoreDocument {
  timestamp: null | firebase.firestore.FieldValue;
  notes: null | string;
  activities: Activity[];
}

export interface Activity extends FirestoreDocument {
  name: string;
  sets: ActivitySet[];
  notes: null | string;
  timestamp: null | firebase.firestore.FieldValue;
}

interface ActivitySet {
  name: null | string;
  repCount: null | number;
  notes: null | string;
  status: ActivityStatus;
  // mediaUrl: null | string;
}

enum ActivityStatus {
  Unattempted = 'unattempted',
  Completed = 'completed',
  Injured = 'injured',
}
