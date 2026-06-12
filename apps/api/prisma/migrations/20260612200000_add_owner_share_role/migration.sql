-- Co-propriétaires : un partage peut porter le rôle OWNER.
-- (PG ≥ 12 : ADD VALUE est permis en transaction tant que la valeur n'est pas utilisée dans la même.)
ALTER TYPE "BoardRole" ADD VALUE 'OWNER';
