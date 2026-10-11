package storage

import (
	"slices"
	"testing"
)

type publicOnly struct{ Disabled }

func (publicOnly) PublicURL(key string) string { return "https://img.test/" + key }

func TestVariantKey(t *testing.T) {
	cases := map[string]string{
		"listings/7/abc.jpg":  "listings/7/abc-w480.jpg",
		"listings/7/abc.webp": "listings/7/abc-w480.jpg",
		"listings/7/abc":      "listings/7/abc-w480.jpg",
		"a.b/7/abc":           "a.b/7/abc-w480.jpg",
	}
	for key, want := range cases {
		if got := VariantKey(key, 480); got != want {
			t.Errorf("VariantKey(%q) = %q, attesa %q", key, got, want)
		}
	}
	if got := ImageKeys("listings/7/abc.png", []int32{480, 960}); !slices.Equal(got, []string{"listings/7/abc.png", "listings/7/abc-w480.jpg", "listings/7/abc-w960.jpg"}) {
		t.Errorf("ImageKeys = %v", got)
	}
}

func TestSrcset(t *testing.T) {
	got := Srcset(publicOnly{}, "listings/7/abc.jpg", []int32{480, 960})
	want := "https://img.test/listings/7/abc-w480.jpg 480w, https://img.test/listings/7/abc-w960.jpg 960w, https://img.test/listings/7/abc.jpg 1600w"
	if got != want {
		t.Errorf("Srcset = %q", got)
	}
	if Srcset(publicOnly{}, "listings/7/abc.jpg", nil) != "" {
		t.Error("senza versioni ridotte lo srcset è vuoto")
	}
	if Srcset(Disabled{}, "listings/7/abc.jpg", []int32{480}) != "" {
		t.Error("senza storage lo srcset è vuoto")
	}
}
