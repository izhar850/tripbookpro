import {
  collection,
  onSnapshot,
  query,
  where,
  type Firestore,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";

type OwnedProfile = {
  uid: string;
  companyId?: string;
};

export function subscribeToOwnedCollection(
  db: Firestore,
  collectionName: string,
  profile: OwnedProfile,
  extraConstraints: QueryConstraint[],
  onRows: (rows: any[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const snapshots = new Map<string, Map<string, any>>();
  const unsubscribers: Unsubscribe[] = [];

  const emitRows = () => {
    const merged = new Map<string, any>();
    snapshots.forEach((rows) => {
      rows.forEach((row, id) => merged.set(id, row));
    });
    onRows(Array.from(merged.values()));
  };

  const subscribe = (key: string, field: "companyId" | "userId", value?: string) => {
    if (!value) return;

    const ownedQuery = query(
      collection(db, collectionName),
      where(field, "==", value),
      ...extraConstraints
    );

    const unsubscribe = onSnapshot(
      ownedQuery,
      (snapshot) => {
        const rows = new Map<string, any>();
        snapshot.docs.forEach((rowDoc) => {
          rows.set(rowDoc.id, { id: rowDoc.id, ...rowDoc.data() });
        });
        snapshots.set(key, rows);
        emitRows();
      },
      (error) => {
        snapshots.delete(key);
        onError?.(error);
        emitRows();
      }
    );

    unsubscribers.push(unsubscribe);
  };

  subscribe("company", "companyId", profile.companyId || profile.uid);
  if (profile.companyId !== profile.uid) {
    subscribe("user", "userId", profile.uid);
  }

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
