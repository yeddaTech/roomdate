package validate

import (
	"testing"
	"time"
)

func TestCleanText(t *testing.T) {
	cases := map[string]string{
		"Cerco un'amica vicino all'università":         "Cerco un'amica vicino all'università",
		"Bagno & cucina, \"luminosa\"":                 "Bagno & cucina, \"luminosa\"",
		"Prezzo < 500 €":                               "Prezzo < 500 €",
		"<b>grassetto</b> e <i>corsivo</i>":            "grassetto e corsivo",
		"Titolo<script>alert(1)</script>":              "Titolo",
		"foto <img src=x onerror=alert(1)> qui":        "foto  qui",
		"  spazi attorno  ":                            "spazi attorno",
		"già salvato una volta: un&#39;amica &amp; co": "già salvato una volta: un'amica & co",
	}
	for input, want := range cases {
		if got := CleanText(input); got != want {
			t.Errorf("CleanText(%q) = %q, atteso %q", input, got, want)
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
