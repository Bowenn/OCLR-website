-- #261 is a correction to stored S10 archive data, not a read-time schema rule.
-- Preserve past revisions and use the same row lock as tournamentCommand.
DO $$
DECLARE
  current_state edition_state%ROWTYPE;
  corrected_pools jsonb;
  corrected_configuration jsonb;
  next_revision integer;
BEGIN
  SELECT * INTO current_state FROM edition_state WHERE slug = 's10' FOR UPDATE;
  IF NOT FOUND
    OR current_state.configuration->>'status' IS DISTINCT FROM 'completed'
    OR current_state.configuration#>>'{archive,editionSlug}' IS DISTINCT FROM 's10'
    OR jsonb_typeof(current_state.configuration#>'{archive,pools}') IS DISTINCT FROM 'array'
  THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(current_state.configuration#>'{archive,pools}') AS p(pool)
    WHERE strpos(pool->>'name', '//') > 0
      AND regexp_replace(split_part(pool->>'name', '//', 1), '^[[:space:]]+|[[:space:]]+$', '', 'g') = ''
  ) THEN
    RAISE EXCEPTION 'S10 pool name before // must not be empty';
  END IF;

  SELECT jsonb_agg(
    CASE WHEN strpos(pool->>'name', '//') > 0 THEN
      jsonb_set(pool, '{name}', to_jsonb(regexp_replace(
        split_part(pool->>'name', '//', 1), '^[[:space:]]+|[[:space:]]+$', '', 'g'
      )), false)
    ELSE pool END ORDER BY position
  ) INTO corrected_pools
  FROM jsonb_array_elements(current_state.configuration#>'{archive,pools}') WITH ORDINALITY AS p(pool, position);

  IF corrected_pools IS NULL OR corrected_pools = current_state.configuration#>'{archive,pools}' THEN
    RETURN;
  END IF;
  corrected_configuration := jsonb_set(current_state.configuration, '{archive,pools}', corrected_pools, false);
  next_revision := current_state.configuration_version + 1;

  INSERT INTO edition_revisions (edition_slug, version, configuration)
  VALUES ('s10', next_revision, corrected_configuration);
  UPDATE edition_state
  SET configuration = corrected_configuration,
      configuration_version = next_revision,
      configuration_updated_at = now()
  WHERE slug = 's10';
  INSERT INTO edition_events (edition_slug, actor_id, kind, detail)
  VALUES ('s10', NULL, 'tournament_archive', jsonb_build_object(
    'source', '0036_s10_pool_names',
    'entity', jsonb_build_object('type', 'tournament', 'id', 's10'),
    'before', jsonb_build_object('configuration', current_state.configuration, 'revision', current_state.configuration_version),
    'after', jsonb_build_object('configuration', corrected_configuration, 'revision', next_revision)
  ));
END $$;
