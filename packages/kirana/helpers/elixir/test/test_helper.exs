ExUnit.start()

defmodule Kirana.Fixtures do
  def map do
    %{
      "version" => 1,
      "prefix" => "k",
      "families" => %{"four" => 45, "two" => 111},
      "classes" => %{"card" => "k3_aaaa k1x_bbbb", "card.active" => "k3_cccc", "quiet" => "k3_"}
    }
  end
end
