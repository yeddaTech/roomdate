package users

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"roomdate-backend/internal/page"
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
	created := time.Date(2026, 9, 17, 10, 30, 0, 123456000, time.UTC)
	id := "3f0c7e2a-8b1d-4c5e-9f6a-0b1c2d3e4f5a"
	got, ok := decodeRoommatesCursor(encodeRoommatesCursor(RoommatesCursor{CreatedAt: &created, ID: id}))
	if !ok || got.CreatedAt == nil || !got.CreatedAt.Equal(created) || got.ID != id {
		t.Errorf("andata e ritorno = %+v, %v", got, ok)
	}
	// Profilo senza data di creazione: il cursore la lascia vuota
	got, ok = decodeRoommatesCursor(encodeRoommatesCursor(RoommatesCursor{ID: id}))
	if !ok || got.CreatedAt != nil || got.ID != id {
		t.Errorf("cursore senza data = %+v, %v", got, ok)
	}

	for _, bad := range []string{"", "!!", page.Encode("2026-09-17T10:30:00Z"), page.Encode("2026-09-17T10:30:00Z", "non-uuid"),
		page.Encode("ieri", id), page.Encode("2026-09-17T10:30:00Z", strings.ToUpper(id))} {
		if _, ok := decodeRoommatesCursor(bad); ok {
			t.Errorf("cursore %q accettato", bad)
		}
	}
}
