package users

import (
	"encoding/base64"
	"reflect"
	"testing"
	"time"
)

func TestCompare(t *testing.T) {
	giulia := profileFacts{City: "Milano", BudgetMax: 600, LifestyleTags: []string{"non_fumatore", "ordinato", "socievole"}}
	cases := []struct {
		name  string
		other profileFacts
		want  Compatibility
	}{
		{
			"tutto in comune",
			profileFacts{City: "Milano", BudgetMax: 700, LifestyleTags: []string{"socievole", "non_fumatore", "animali"}},
			Compatibility{SameCity: true, SimilarBudget: true, SharedTags: []string{"non_fumatore", "socievole"}},
		},
		{
			"budget oltre 100 euro di differenza e fumatore",
			profileFacts{City: "Roma", BudgetMax: 701, LifestyleTags: []string{"fumatore", "ordinato"}},
			Compatibility{SharedTags: []string{"ordinato"}, SmokingMismatch: true},
		},
		{
			"profilo vuoto: nessun elemento in comune",
			profileFacts{},
			Compatibility{SharedTags: []string{}},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := compare(giulia, c.other); !reflect.DeepEqual(got, c.want) {
				t.Errorf("compare = %+v, atteso %+v", got, c.want)
			}
			// Il confronto è simmetrico
			if got := compare(c.other, giulia); !reflect.DeepEqual(got, c.want) {
				t.Errorf("compare invertito = %+v, atteso %+v", got, c.want)
			}
		})
	}

	// Città e budget non indicati da nessuno dei due non contano come "in comune"
	if got := compare(profileFacts{}, profileFacts{}); got.SameCity || got.SimilarBudget {
		t.Errorf("profili vuoti = %+v", got)
	}
}

func TestRoommatesCursor(t *testing.T) {
	want := RoommatesCursor{CreatedAt: time.Date(2026, 9, 17, 10, 30, 0, 123456000, time.UTC), ID: "3f0c7e2a-8b1d-4c5e-9f6a-0b1c2d3e4f5a"}
	if got, ok := decodeRoommatesCursor(encodeRoommatesCursor(want)); !ok || !got.CreatedAt.Equal(want.CreatedAt) || got.ID != want.ID {
		t.Errorf("andata e ritorno = %+v, %v", got, ok)
	}

	raw := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }
	for _, bad := range []string{"", "!!", raw("123"), raw("12_non-uuid"), raw("x_3f0c7e2a-8b1d-4c5e-9f6a-0b1c2d3e4f5a"), raw("12_3F0C7E2A-8B1D-4C5E-9F6A-0B1C2D3E4F5A'")} {
		if _, ok := decodeRoommatesCursor(bad); ok {
			t.Errorf("cursore %q accettato", bad)
		}
	}
}
