import {Location} from "@angular/common";
import {AfterViewInit, Directive, ElementRef} from "@angular/core";
import {NavigationEnd, Router} from "@angular/router";
import * as $ from "jquery";

@Directive({selector: "[myHighlightActiveItems]"})

export class HighlightActiveItemsDirective implements AfterViewInit {
  constructor(private el: ElementRef, private location: Location, private router: Router) {
  }

  ngAfterViewInit() {
    const $el = $(this.el.nativeElement);
    const $links = $el.find("a");

    function highlightActive(links) {
      const path = location.hash;
      // console.log(path);

      links.each((i, link) => {
        const $link = $(link);
        const $li = $link.parent("li");
        const href = $link.attr("href");
        // console.log(href);

        if ($li.hasClass("active")) {
          $li.removeClass("active");
        }
        if (path.indexOf(href) === 0) {
          $li.addClass("active");
        }
      });
    }

    highlightActive($links);

    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      highlightActive($links);
    });
  }
}
