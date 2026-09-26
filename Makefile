CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra

zetamac: zetamac.cpp
	$(CXX) $(CXXFLAGS) -o $@ $<

play: zetamac
	./zetamac

tracker: zetamac
	./zetamac tracker

clean:
	rm -f zetamac

.PHONY: play tracker clean
