
CREATE TABLE IF NOT EXISTS "temp" (
    "id" serial PRIMARY KEY,
    "temp1" text NOT NULL,
    "temp2" text NOT NULL,
    "created_at" timestamp DEFAULT now()
);
