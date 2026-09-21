package validate

import (
	"testing"
	"time"
)

func TestText(t *testing.T) {
	cases := map[string]string{
		"Cerco un'amica vicino all'università": "Cerco un'amica vicino all'università",
		"Bagno & cucina, \"luminosa\"":         "Bagno & cucina, \"luminosa\"",
		"Prezzo < 500 € e <b>non</b> è HTML":   "Prezzo < 500 € e <b>non</b> è HTML",
		"un&#39;amica resta com'è":             "un&#39;amica resta com'è",
		"  spazi attorno  ":                    "spazi attorno",
		"riga 1\nriga 2\tcon tab":              "riga 1\nriga 2\tcon tab",
		"nul\x00 e bell\x07 rimossi\u200b":     "nul e bell rimossi\u200b",
		"utf8 non valido \xff":                 "utf8 non valido",
	}
	for input, want := range cases {
		if got := Text(input); got != want {
			t.Errorf("Text(%q) = %q, atteso %q", input, got, want)
		}
	}
}

func TestDateBetween(t *testing.T) {
	min := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	max := time.Date(2028, 9, 16, 0, 0, 0, 0, time.UTC)
	for s, want := range map[string]bool{
		"2026-01-01": true, "2027-06-30": true, "2028-09-16": true,
		"2025-12-31": false, "2028-09-17": false, "": false, "30/06/2027": false, "2027-02-30": false,
	} {
		if got := DateBetween(s, min, max); got != want {
			t.Errorf("DateBetween(%q) = %v, atteso %v", s, got, want)
		}
	}
}

func TestValidator(t *testing.T) {
	var v Validator
	v.Check(true, "a", "non deve comparire")
	if v.Err() != nil {
		t.Fatal("nessun errore atteso")
	}
	v.Check(false, "nome", "Il nome è obbligatorio")
	v.Check(false, "email", "Email non valida")

	err := v.Err()
	if err == nil || err.Error() != "validation_failed: Il nome è obbligatorio" {
		t.Fatalf("errore = %v", err)
	}
}

func TestMaxLenCountsCharacters(t *testing.T) {
	if !MaxLen("università", 10) {
		t.Error(`"università" ha 10 caratteri`)
	}
	if MaxLen("università!", 10) {
		t.Error(`"università!" supera 10 caratteri`)
	}
}

func TestEmail(t *testing.T) {
	for _, valid := range []string{"mario@esempio.it", "a.b+c@sub.dominio.com"} {
		if !Email(valid) {
			t.Errorf("%q dovrebbe essere valida", valid)
		}
	}
	for _, invalid := range []string{"", "mario", "mario@", "Mario <mario@esempio.it>", " mario@esempio.it"} {
		if Email(invalid) {
			t.Errorf("%q non dovrebbe essere valida", invalid)
		}
	}
}

func TestPastDate(t *testing.T) {
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	for s, want := range map[string]bool{
		"1999-04-12": true,
		"2026-09-16": true,
		"2026-09-17": false,
		"1899-12-31": false,
		"":           false,
		"12/04/1999": false,
		"1999-02-30": false,
	} {
		if got := PastDate(s, now); got != want {
			t.Errorf("PastDate(%q) = %v, atteso %v", s, got, want)
		}
	}
}

func TestBase64(t *testing.T) {
	if !Base64("aGVsbG8=", 16) {
		t.Error("Base64 valido rifiutato")
	}
	if Base64("non base64!", 64) {
		t.Error("Base64 non valido accettato")
	}
	if Base64("aGVsbG8=", 4) {
		t.Error("lunghezza massima ignorata")
	}
}

func TestPositiveID(t *testing.T) {
	for s, want := range map[string]bool{"1": true, "42": true, "0": false, "-3": false, "abc": false, "": false, "1.5": false} {
		if _, got := PositiveID(s); got != want {
			t.Errorf("PositiveID(%q) = %v, atteso %v", s, got, want)
		}
	}
}

func TestAgeAtLeast(t *testing.T) {
	day := func(s string) time.Time {
		d, _ := time.Parse(time.DateOnly, s)
		return d.Add(15 * time.Hour)
	}
	for _, c := range []struct {
		birthdate, today string
		adult            bool
	}{
		{"2008-09-21", "2026-09-21", true},  // compie 18 anni oggi
		{"2008-09-22", "2026-09-21", false}, // domani
		{"2008-10-01", "2026-09-21", false}, // mese dopo
		{"1990-01-01", "2026-09-21", true},
		{"2008-02-29", "2026-02-28", false}, // nato il 29 febbraio: in un anno non bisestile li compie il 1° marzo
		{"2008-02-29", "2026-03-01", true},
		{"2010-03-01", "2028-02-29", false}, // oggi è il 29 febbraio: il 1° marzo è domani
		{"2010-03-01", "2028-03-01", true},
		{"non-una-data", "2026-09-21", false},
	} {
		if got := AgeAtLeast(c.birthdate, day(c.today), 18); got != c.adult {
			t.Errorf("AgeAtLeast(%s, %s) = %v, atteso %v", c.birthdate, c.today, got, c.adult)
		}
	}
}
