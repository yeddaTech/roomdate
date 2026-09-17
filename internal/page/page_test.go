package page

import (
	"slices"
	"strings"
	"testing"
)

func TestEncodeDecode(t *testing.T) {
	cursor := Encode("2026-09-17T10:30:00.123456", "42")
	if strings.ContainsAny(cursor, "+/= ") {
		t.Errorf("il cursore deve stare in un URL senza codifiche: %q", cursor)
	}
	fields, ok := Decode(cursor, 2)
	if !ok || !slices.Equal(fields, []string{"2026-09-17T10:30:00.123456", "42"}) {
		t.Fatalf("Decode = %q, %v", fields, ok)
	}
	if empty, ok := Decode(Encode("", "7"), 2); !ok || !slices.Equal(empty, []string{"", "7"}) {
		t.Errorf("un campo vuoto deve sopravvivere: %q, %v", empty, ok)
	}
}

func TestDecodeRejectsInvalid(t *testing.T) {
	for _, cursor := range []string{"", "non-base64!", Encode("solo-uno"), Encode("a", "b", "c")} {
		if fields, ok := Decode(cursor, 2); ok {
			t.Errorf("Decode(%q) = %q: doveva essere rifiutato", cursor, fields)
		}
	}
}
