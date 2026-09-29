CREATE FUNCTION portatlas_refresh_search(target_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Serialize refreshes for this service. A cascading DELETE may leave no row.
    PERFORM 1 FROM services WHERE id = target_id FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    UPDATE services AS s SET search_text = lower(regexp_replace(concat_ws(' ',
        s.name, s.description, s.project, s.environment, s.service_type, s.status,
        s.container_name, s.docker_image, s.compose_path, s.working_directory,
        s.healthcheck_url, s.swagger_url, s.management_url, s.owner, s.notes,
        host(h.ip), h.name, h.hostname, h.ssh_port::text, h.ssh_user,
        h.description, h.location, array_to_string(h.tags, ' '),
        (SELECT string_agg(alias, ' ' ORDER BY alias) FROM service_aliases WHERE service_id = s.id),
        (SELECT string_agg(tag, ' ' ORDER BY tag) FROM service_tags WHERE service_id = s.id),
        (SELECT string_agg(concat_ws(' ', name, port::text, protocol, description), ' ' ORDER BY port, name)
            FROM service_ports WHERE service_id = s.id),
        (SELECT string_agg(concat_ws(' ', name, url, endpoint_type), ' ' ORDER BY name, id)
            FROM service_endpoints WHERE service_id = s.id),
        (SELECT string_agg(concat_ws(' ', name, command, command_type), ' ' ORDER BY name, id)
            FROM service_commands WHERE service_id = s.id)
    ), '\s+', ' ', 'g')) FROM servers AS h
    WHERE s.id = target_id AND h.id = s.server_id;
END;
$$;
-- statement-break
CREATE FUNCTION portatlas_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Only registered edit columns fire this trigger on services. Do not read
    -- generated search_vector in a BEFORE trigger: PostgreSQL computes it later.
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;
-- statement-break
CREATE FUNCTION portatlas_service_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM portatlas_refresh_search(NEW.id);
    RETURN NULL;
END;
$$;
-- statement-break
CREATE FUNCTION portatlas_server_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid;
BEGIN
    FOR target_id IN SELECT id FROM services WHERE server_id = NEW.id ORDER BY id LOOP
        PERFORM portatlas_refresh_search(target_id);
    END LOOP;
    RETURN NULL;
END;
$$;
-- statement-break
CREATE FUNCTION portatlas_child_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_id uuid; next_id uuid; target_id uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN previous_id = OLD.service_id; END IF;
    IF TG_OP <> 'DELETE' THEN next_id = NEW.service_id; END IF;
    FOR target_id IN
        SELECT DISTINCT value FROM unnest(ARRAY[previous_id, next_id]) AS ids(value)
        WHERE value IS NOT NULL ORDER BY value
    LOOP
        PERFORM portatlas_refresh_search(target_id);
        -- A change in nested records is a service edit too.
        UPDATE services SET updated_at = clock_timestamp() WHERE id = target_id;
    END LOOP;
    RETURN NULL;
END;
$$;
-- statement-break
CREATE TRIGGER servers_updated_at BEFORE UPDATE ON servers
FOR EACH ROW EXECUTE FUNCTION portatlas_touch_updated_at();
-- statement-break
CREATE TRIGGER services_updated_at BEFORE UPDATE OF
    server_id, name, description, project, environment, service_type, status,
    container_name, docker_image, compose_path, working_directory,
    healthcheck_url, swagger_url, management_url, owner, notes ON services
FOR EACH ROW EXECUTE FUNCTION portatlas_touch_updated_at();
-- statement-break
CREATE TRIGGER services_search_insert AFTER INSERT ON services
FOR EACH ROW EXECUTE FUNCTION portatlas_service_changed();
-- statement-break
CREATE TRIGGER services_search_update AFTER UPDATE OF
    server_id, name, description, project, environment, service_type, status,
    container_name, docker_image, compose_path, working_directory,
    healthcheck_url, swagger_url, management_url, owner, notes ON services
FOR EACH ROW EXECUTE FUNCTION portatlas_service_changed();
-- statement-break
CREATE TRIGGER servers_search_update AFTER UPDATE OF
    name, hostname, ip, ssh_port, ssh_user, description, location, tags ON servers
FOR EACH ROW EXECUTE FUNCTION portatlas_server_changed();
-- statement-break
CREATE TRIGGER service_ports_search AFTER INSERT OR UPDATE OR DELETE ON service_ports
FOR EACH ROW EXECUTE FUNCTION portatlas_child_changed();
-- statement-break
CREATE TRIGGER service_aliases_search AFTER INSERT OR UPDATE OR DELETE ON service_aliases
FOR EACH ROW EXECUTE FUNCTION portatlas_child_changed();
-- statement-break
CREATE TRIGGER service_tags_search AFTER INSERT OR UPDATE OR DELETE ON service_tags
FOR EACH ROW EXECUTE FUNCTION portatlas_child_changed();
-- statement-break
CREATE TRIGGER service_commands_search AFTER INSERT OR UPDATE OR DELETE ON service_commands
FOR EACH ROW EXECUTE FUNCTION portatlas_child_changed();
-- statement-break
CREATE TRIGGER service_endpoints_search AFTER INSERT OR UPDATE OR DELETE ON service_endpoints
FOR EACH ROW EXECUTE FUNCTION portatlas_child_changed();
