ALTER TABLE ciclo ADD CONSTRAINT ciclo_abierto_por_fk FOREIGN KEY(abierto_por) REFERENCES cuenta(id);
ALTER TABLE ciclo ADD CONSTRAINT ciclo_cerrado_por_fk FOREIGN KEY(cerrado_por) REFERENCES cuenta(id);
