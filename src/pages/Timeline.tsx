import { css } from '@emotion/css';
import { Typography } from '@material-ui/core';
import { SearchOutlined } from '@material-ui/icons';
import {
  createPopper,
  Instance as PopperInstance,
} from '@popperjs/core/lib/popper-lite';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { TrainingLogView } from '../components/TrainingLogView';
import { Paths, TabIndex } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { User } from '../interfaces';
import { Columns, Pad, Rows } from '../style';

const listItemStyle = css`
  text-transform: none;
  padding: ${Pad.Medium};
  white-space: nowrap;
`;

export const Timeline: FC = () => {
  /** #region Search input auto-completion  */
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popperRef = useRef<PopperInstance | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const openSuggestions = () => {
    setShowSuggestions(true);
    suggestionsRef.current?.setAttribute('data-show', '');
  };
  const closeSuggestions = () => {
    setShowSuggestions(false);
    suggestionsRef.current?.removeAttribute('data-show');
  };
  useEffect(() => {
    if (!inputRef.current || !suggestionsRef.current) return;
    popperRef.current = createPopper(inputRef.current, suggestionsRef.current);
    return () => popperRef.current?.destroy();
  });
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    const onBlur = (event: FocusEvent) => {
      if (showSuggestions && !event.relatedTarget) setShowSuggestions(false);
    };
    const onKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSuggestions();
    };
    const onChange = (event: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((event.target as any)?.value === '') closeSuggestions();
      else openSuggestions();
    };
    node.addEventListener('blur', onBlur);
    node.addEventListener('keypress', onKeyPress);
    node.addEventListener('change', onChange);
    return () => {
      node.removeEventListener('blur', onBlur);
      node.removeEventListener('keypress', onKeyPress);
      node.removeEventListener('change', onChange);
    };
  }, [showSuggestions]);
  /** #endregion */

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<
    DataState<Pick<User, 'id' | 'displayName'>[]>
  >(DataState.Empty);

  const history = useHistory();

  useEffect(() => {
    const searchUsers = async () => {
      if (!search.length) return;
      setResults(DataState.Loading);
      try {
        const { docs } = await db.collection(DbPath.Users).get();
        const matches = docs.flatMap<Pick<User, 'id' | 'displayName'>>(doc => {
          const displayName = doc.get('displayName') as string;
          if (displayName.toLowerCase().startsWith(search.toLowerCase())) {
            return [{ displayName, id: doc.id }];
          }
          return [];
        });
        setResults(matches);
      } catch (error) {
        alert(error.message);
        setResults(DataState.error(error.message));
      }
    };
    const id = setTimeout(searchUsers, 250);
    return () => clearTimeout(id);
  }, [search]);

  return (
    <Columns
      maxWidth
      className={css`
        height: 100%;
        overflow-y: scroll;
      `}
    >
      <Rows
        maxWidth
        center
        pad={Pad.XSmall}
        className={css`
          padding: ${Pad.Medium};
          border-bottom: 1px solid lightgray;
          background-color: #eee;
        `}
      >
        <SearchOutlined htmlColor="gray" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search TrainingFor"
          value={search}
          // TODO Move open & closeSuggestions out of this listener
          onChange={event => {
            // Do not flash previous results
            setResults(DataState.Empty);
            setSearch(event.target.value);
            if (event.target.value === '') closeSuggestions();
            else openSuggestions();
          }}
          className={css`
            width: 100%;
            padding: ${Pad.Medium};
            border: 0;
            background-color: #fff;
            border-radius: 5px;
            font-size: 1em;
          `}
        />
      </Rows>
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className={css`
            width: 85%;
            background-color: #fff;
            border-radius: 5px;
            box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);
            z-index: 100;
          `}
        >
          <DataStateView
            data={results}
            error={() => (
              <Typography color="error" variant="body1">
                Something went wrong.
              </Typography>
            )}
          >
            {results => (
              <ul
                tabIndex={TabIndex.NotFocusable}
                className={css`
                  list-style-type: none;
                  max-height: 400px;
                  overflow-y: scroll;
                  padding: 0;

                  & > *:not(:last-child) {
                    border-bottom: 1px solid lightgray;
                  }
                `}
                onKeyDown={event => {
                  if (event.key === 'Escape') closeSuggestions();
                }}
              >
                {results.length ? (
                  results.map(user => (
                    <li
                      key={user.id}
                      className={listItemStyle}
                      tabIndex={TabIndex.Focusable}
                      onClick={() => history.push(Paths.user(user.id))}
                    >
                      <b>{user.displayName.slice(0, search.length)}</b>
                      {user.displayName.slice(search.length)}
                    </li>
                  ))
                ) : (
                  <li
                    className={listItemStyle}
                    tabIndex={TabIndex.NotFocusable}
                  >
                    No matches
                  </li>
                )}
              </ul>
            )}
          </DataStateView>
        </div>
      )}
      <TimelineView />
    </Columns>
  );
};

const TimelineView: FC = () => {
  const user = useUser();

  const [followedUsersLogs] = useDataState(async () => {
    const following = await db
      .collection(DbPath.Users)
      .doc(user.uid)
      .get()
      .then(doc => doc.get('following') as string[]);
    /** The five latest logs of each followed user. */
    const promisesForLogs = following.map(authorId =>
      db
        .collection(DbPath.Users)
        .doc(authorId)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get()
        .then(snapshot =>
          snapshot.docs.map(doc => {
            const log = doc.data();
            // TODO Remove `authorId` as TrainingLog DB docs are updated
            log.authorId = authorId;
            return log;
          })
        )
    );
    const logs = await Promise.all(promisesForLogs);
    // TODO sort
    return logs.flatMap(log => log);
  }, [user.uid]);

  return (
    <DataStateView
      data={followedUsersLogs}
      error={() => (
        <Typography color="error" variant="body1">
          Something went wrong.
        </Typography>
      )}
    >
      {logs => (
        <Columns
          pad={Pad.None}
          className={css`
            height: 100%;
            overflow-y: scroll;
          `}
        >
          {logs.map(log => (
            <TrainingLogView key={log.id} log={log} />
          ))}
        </Columns>
      )}
    </DataStateView>
  );
};
