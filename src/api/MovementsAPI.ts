import { useState, useEffect } from 'react';

import { API } from '.';
import { Movement } from '../types';
import { DataState } from '../util';
import { db, DbPath } from './firebase';

// export const useMovements = ({ logId }) => {
//   const [state, setState] = useState<DataState<Movement[]>>(DataState.Loading);

//   useEffect(() => {
//     onSNap
//     // return API.collections.movements
//     // .orderBy('position', 'asc').onSnapshot(
//     //   snapshot => setState(snapshot.docs.map(doc => doc.data)),
//     //   error => setState(DataState.error(error.message))
//     // );
//   }, []);

//   return state;
// };


